import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play, Terminal } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ScriptRunnerProps {
  serverId: string;
}

export function ScriptRunner({ serverId }: ScriptRunnerProps) {
  const { t } = useTranslation();
  const [selectedScript, setSelectedScript] = useState('');
  const [args, setArgs] = useState('');
  const [timeout, setTimeout] = useState(300);
  const [logs, setLogs] = useState<Array<{ type: string; content: string }>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const MAX_RECONNECT_ATTEMPTS = 5;

  const { data: scripts } = useQuery({
    queryKey: ['scripts', serverId],
    queryFn: () => api.getScripts(serverId),
  });

  const runMutation = useMutation({
    mutationFn: () =>
      api.runScript(serverId, {
        scriptPath: selectedScript,
        args: args ? args.split(' ') : undefined,
        timeoutSec: timeout,
      }),
    onSuccess: (data) => {
      setJobId(data.jobId);
      setIsRunning(true);
      setLogs([]);
      connectWebSocket(data.jobId);
    },
    onError: (error: any) => {
      toast.error(error.message || t('components.scriptRunner.scriptExecutionFailed'));
    },
  });

  const connectWebSocket = (targetJobId: string) => {
    // Track whether this connection received a terminal status (success/failed/error)
    let jobFinished = false;

    const wsUrl = api.getWebSocketUrl(targetJobId);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttemptRef.current = 0; // reset on successful connect
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'log') {
        setLogs((prev) => [
          ...prev,
          {
            type: message.data.type,
            content: message.data.content,
          },
        ]);
      } else if (message.type === 'status') {
        jobFinished = true;
        setIsRunning(false);
        if (message.data.status === 'success') {
          toast.success(t('components.scriptRunner.scriptCompleted', { code: message.data.exitCode || 0 }));
        } else {
          toast.error(t('components.scriptRunner.scriptFailed', { code: message.data.exitCode }));
        }
      } else if (message.type === 'error') {
        jobFinished = true;
        setIsRunning(false);
        toast.error(message.data.error || t('components.scriptRunner.scriptExecutionFailed'));
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      // Only reconnect if job hasn't finished and we haven't exhausted attempts
      if (!jobFinished && reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
        const attempt = reconnectAttemptRef.current++;
        const delay = Math.min(1000 * Math.pow(2, attempt), 16000); // 1s, 2s, 4s, 8s, 16s
        console.log(`WebSocket reconnecting in ${delay}ms (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);
        reconnectTimerRef.current = window.setTimeout(() => {
          connectWebSocket(targetJobId);
        }, delay);
      } else if (!jobFinished) {
        setIsRunning(false);
        toast.error(t('components.scriptRunner.wsConnectionFailed'));
      }
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleRun = () => {
    if (!selectedScript) {
      toast.error(t('components.scriptRunner.selectScriptError'));
      return;
    }
    runMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4" />
            {t('components.scriptRunner.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white">{t('components.scriptRunner.script')}</label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={selectedScript}
              onChange={(e) => setSelectedScript(e.target.value)}
            >
              <option value="" className="bg-gray-900 text-white">{t('components.scriptRunner.selectScript')}</option>
              {scripts?.map((script) => (
                <option key={script} value={script} className="bg-gray-900 text-white">
                  {script}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-white">{t('components.scriptRunner.arguments')}</label>
            <Input
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder={t('components.scriptRunner.argumentsPlaceholder')}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white">{t('components.scriptRunner.timeoutSeconds')}</label>
            <Input
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(parseInt(e.target.value))}
            />
          </div>

          <Button
            onClick={handleRun}
            disabled={!selectedScript || isRunning}
            className="w-full"
          >
            <Play className="mr-2 h-4 w-4" />
            {isRunning ? t('components.scriptRunner.running') : t('components.scriptRunner.run')}
          </Button>
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('components.scriptRunner.liveLogs')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 overflow-auto rounded-md bg-black p-4 font-mono text-sm">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={log.type === 'stderr' ? 'text-red-400' : 'text-green-400'}
                >
                  {log.content}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

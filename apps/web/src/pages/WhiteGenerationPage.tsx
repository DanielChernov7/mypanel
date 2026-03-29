import { useState, useEffect } from 'react';
import { Wand2, KeyRound, MessageSquareText, Eye, EyeOff, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ApiKeyFieldProps {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  placeholder?: string;
}

function ApiKeyField({ label, description, value, onChange, onSave, saving, placeholder }: ApiKeyFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'sk-...'}
            className="pr-10 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button onClick={onSave} disabled={saving} size="sm" variant="outline">
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Save
        </Button>
      </div>
    </div>
  );
}

interface PromptFieldProps {
  label: string;
  description: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  rows?: number;
  placeholders?: string[];
}

function PromptField({ label, description, hint, value, onChange, onSave, saving, rows = 6, placeholders }: PromptFieldProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-foreground">{label}</label>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <>
          {placeholders && placeholders.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {placeholders.map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => onChange(value + ph)}
                  className="px-2 py-0.5 rounded bg-muted text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Click to insert"
                >
                  {ph}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            placeholder={hint}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{value.length} chars</span>
            <Button onClick={onSave} disabled={saving} size="sm" variant="outline">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

const PROMPT_PLACEHOLDERS = ['{domain}', '{offer}', '{geo}', '{buyerTag}', '{lang}'];

const DEFAULT_SYSTEM_PROMPT = `You are a professional web developer who creates high-quality white-hat landing pages for various offers. Your pages must look legitimate, load fast, and be well-structured with semantic HTML. Use inline CSS for all styles. Always include a header, main content area, and footer. The page should feel like a real business website.`;

const DEFAULT_CONTENT_PROMPT = `Create a complete HTML landing page for the following:
- Domain: {domain}
- Offer: {offer}
- Target country/geo: {geo}
- Language: {lang}

Requirements:
- Full HTML5 document with DOCTYPE, head, body
- Inline CSS styles only (no external stylesheets)
- Professional design matching the offer niche
- Include: logo placeholder, navigation, hero section, features, CTA button, footer
- Mobile responsive (use flexbox/grid)
- Realistic company name and contact info
- No placeholder text like "Lorem ipsum"
- Return ONLY the HTML code, nothing else`;

export function WhiteGenerationPage() {

  // API Keys state
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openAiKey, setOpenAiKey] = useState('');
  const [deepSeekKey, setDeepSeekKey] = useState('');

  // Prompt state
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [contentPrompt, setContentPrompt] = useState(DEFAULT_CONTENT_PROMPT);
  const [defaultModel, setDefaultModel] = useState('claude-opus-4-6');

  // Saving state per key
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings(),
    staleTime: 60_000,
  });

  // Populate fields from settings
  useEffect(() => {
    if (!settings) return;
    if (settings.whitegenAnthropicKey) setAnthropicKey(settings.whitegenAnthropicKey);
    if (settings.whitegenOpenAiKey) setOpenAiKey(settings.whitegenOpenAiKey);
    if (settings.whitegenDeepSeekKey) setDeepSeekKey(settings.whitegenDeepSeekKey);
    if (settings.whitegenSystemPrompt) setSystemPrompt(settings.whitegenSystemPrompt);
    if (settings.whitegenContentPrompt) setContentPrompt(settings.whitegenContentPrompt);
    if (settings.whitegenDefaultModel) setDefaultModel(settings.whitegenDefaultModel);
  }, [settings]);

  const saveSetting = async (key: string, value: string, label: string) => {
    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await api.updateSetting(key, value);
      toast.success(`${label} saved`);
    } catch (e: any) {
      toast.error(`Failed to save: ${e.message}`);
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Wand2 className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-white">White Generation</h1>
        </div>
        <p className="text-muted-foreground">
          Configure AI providers and prompts for automated white site generation.
        </p>
      </div>

      <Tabs defaultValue="keys">
        <TabsList className="mb-6">
          <TabsTrigger value="keys" className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            AI API Keys
          </TabsTrigger>
          <TabsTrigger value="prompts" className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4" />
            Prompts
          </TabsTrigger>
        </TabsList>

        {/* ── API Keys Tab ── */}
        <TabsContent value="keys">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Anthropic (Claude)</CardTitle>
                <CardDescription>
                  Used with models: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5. Recommended for best quality.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ApiKeyField
                  label="API Key"
                  description="Get it from console.anthropic.com → API Keys"
                  value={anthropicKey}
                  onChange={setAnthropicKey}
                  onSave={() => saveSetting('whitegenAnthropicKey', anthropicKey, 'Anthropic key')}
                  saving={!!saving['whitegenAnthropicKey']}
                  placeholder="sk-ant-..."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">OpenAI</CardTitle>
                <CardDescription>
                  Used with models: gpt-4o, gpt-4o-mini, gpt-4-turbo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ApiKeyField
                  label="API Key"
                  description="Get it from platform.openai.com → API Keys"
                  value={openAiKey}
                  onChange={setOpenAiKey}
                  onSave={() => saveSetting('whitegenOpenAiKey', openAiKey, 'OpenAI key')}
                  saving={!!saving['whitegenOpenAiKey']}
                  placeholder="sk-..."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">DeepSeek</CardTitle>
                <CardDescription>
                  Used with models: deepseek-chat, deepseek-coder. Cost-effective alternative.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ApiKeyField
                  label="API Key"
                  description="Get it from platform.deepseek.com → API Keys"
                  value={deepSeekKey}
                  onChange={setDeepSeekKey}
                  onSave={() => saveSetting('whitegenDeepSeekKey', deepSeekKey, 'DeepSeek key')}
                  saving={!!saving['whitegenDeepSeekKey']}
                  placeholder="sk-..."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Default Model</CardTitle>
                <CardDescription>
                  Which model to use when generating whites if not specified per-domain.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <select
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <optgroup label="Anthropic">
                      <option value="claude-opus-4-6">claude-opus-4-6 (best quality)</option>
                      <option value="claude-sonnet-4-6">claude-sonnet-4-6 (balanced)</option>
                      <option value="claude-haiku-4-5">claude-haiku-4-5 (fast)</option>
                    </optgroup>
                    <optgroup label="OpenAI">
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (cheap)</option>
                    </optgroup>
                    <optgroup label="DeepSeek">
                      <option value="deepseek-chat">deepseek-chat</option>
                    </optgroup>
                  </select>
                  <Button
                    onClick={() => saveSetting('whitegenDefaultModel', defaultModel, 'Default model')}
                    disabled={!!saving['whitegenDefaultModel']}
                    size="sm"
                    variant="outline"
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Prompts Tab ── */}
        <TabsContent value="prompts">
          <div className="space-y-4">
            <div className="rounded-md bg-muted/40 border border-border px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Available placeholders</p>
              <p>
                Click a placeholder to insert it into the active prompt. They will be replaced with real values at generation time.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PROMPT_PLACEHOLDERS.map((ph) => (
                  <code key={ph} className="px-2 py-0.5 rounded bg-background border border-border text-xs font-mono">
                    {ph}
                  </code>
                ))}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">System Prompt</CardTitle>
                <CardDescription>
                  Sets the AI persona and global constraints. Sent as the system message.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PromptField
                  label=""
                  description=""
                  hint="You are a professional web developer..."
                  value={systemPrompt}
                  onChange={setSystemPrompt}
                  onSave={() => saveSetting('whitegenSystemPrompt', systemPrompt, 'System prompt')}
                  saving={!!saving['whitegenSystemPrompt']}
                  rows={6}
                  placeholders={[]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Content Prompt</CardTitle>
                <CardDescription>
                  The main generation prompt. Use placeholders — they are substituted per domain at generation time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PromptField
                  label=""
                  description=""
                  hint="Create a complete HTML landing page for..."
                  value={contentPrompt}
                  onChange={setContentPrompt}
                  onSave={() => saveSetting('whitegenContentPrompt', contentPrompt, 'Content prompt')}
                  saving={!!saving['whitegenContentPrompt']}
                  rows={14}
                  placeholders={PROMPT_PLACEHOLDERS}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

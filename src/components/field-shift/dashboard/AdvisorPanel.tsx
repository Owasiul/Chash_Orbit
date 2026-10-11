"use client";

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '@/lib/store';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { BrainCircuit, Send, Loader2, AlertCircle, RefreshCcw, Database } from 'lucide-react';
import { FullAnalysis } from '@/lib/store';



function ReportSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <Skeleton className="h-5 w-40 mb-3 bg-white/10" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full bg-white/5" />
          <Skeleton className="h-4 w-[95%] bg-white/5" />
          <Skeleton className="h-4 w-[85%] bg-white/5" />
        </div>
      </div>
      <div>
        <Skeleton className="h-5 w-48 mb-3 bg-white/10" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2].map(i => (
            <div key={i} className="rounded-lg border border-white/5 bg-white/5 p-4 space-y-3">
              <Skeleton className="h-4 w-3/4 bg-white/10" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-full bg-white/5" />
                <Skeleton className="h-3 w-4/5 bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-5 w-56 mb-3 bg-white/10" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-md border border-white/5 bg-white/5 p-4 flex justify-between items-center">
              <Skeleton className="h-4 w-32 bg-white/10" />
              <Skeleton className="h-4 w-12 bg-white/5" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-5 w-32 mb-3 bg-white/10" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-[90%] bg-white/5" />
          <Skeleton className="h-3 w-[80%] bg-white/5" />
          <Skeleton className="h-3 w-[85%] bg-white/5" />
        </div>
      </div>
    </div>
  );
}

export function AdvisorPanel({ analysis }: { analysis: FullAnalysis }) {
  const report = useAppStore(s => s.advisorReport);
  const setReport = useAppStore(s => s.setAdvisorReport);
  const [loadingReport, setLoadingReport] = React.useState(false);
  const [reportError, setReportError] = React.useState<string | null>(null);

  const [input, setInput] = React.useState('');
  const advisorChatHistory = useAppStore(s => s.advisorChatHistory);
  const setAdvisorChatHistory = useAppStore(s => s.setAdvisorChatHistory);

  const transport = React.useMemo(() => new DefaultChatTransport({
    api: '/api/field/chat',
    body: { analysis }
  }), [analysis]);

  const { messages, status, sendMessage, error: chatError } = useChat({
    id: `chat-${analysis.field.latitude}-${analysis.field.longitude}`,
    transport,
    messages: advisorChatHistory,
    onError: (err: any) => {
      console.error("Chat error:", err);
    }
  });

  const fetchReport = React.useCallback(async () => {
    setLoadingReport(true);
    setReportError(null);
    try {
      const res = await fetch('/api/field/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch report');
      setReport(data.report);
    } catch (err: any) {
      setReportError(err.message);
    } finally {
      setLoadingReport(false);
    }
  }, [analysis]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReport();
  }, [fetchReport]);

  const renderDataStatus = (status: string) => {
    const map: Record<string, { color: string, label: string }> = {
      LIVE: { color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', label: 'LIVE' },
      CACHED: { color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', label: 'CACHED' },
      DERIVED: { color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', label: 'DERIVED' },
      DEMO: { color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', label: 'DEMO' },
    };
    const s = map[status] || { color: 'bg-gray-500/20 text-gray-300', label: status };
    return <Badge variant="outline" className={`text-[9px] ${s.color}`}>{s.label}</Badge>;
  };

  const chatLoading = status === 'submitted' || status === 'streaming';

  React.useEffect(() => {
    if (messages.length > 0) {
      setAdvisorChatHistory(messages);
    }
  }, [messages, setAdvisorChatHistory]);

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80">
            <BrainCircuit className="size-4" />
            AI Field Report
          </div>
          
          {!loadingReport && reportError && (
             <Button variant="ghost" size="sm" onClick={fetchReport} className="h-6 text-[10px]">
               <RefreshCcw className="mr-1 size-3" /> Retry
             </Button>
          )}
        </div>

        {loadingReport && !report && <ReportSkeleton />}

        {reportError && (
          <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            <div className="flex items-center gap-2 font-bold"><AlertCircle className="size-4"/> Error</div>
            {reportError}
          </div>
        )}

        {report && (
          <div className="space-y-6 text-sm text-muted-foreground">
            <div>
              <h3 className="mb-2 font-semibold text-foreground">Executive Summary</h3>
              <p>{report.executiveSummary}</p>
            </div>

            {report.keyRisks && report.keyRisks.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold text-foreground">Environmental Risks</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {report.keyRisks.map((risk: any, i: number) => (
                    <div key={i} className="rounded-lg border border-white/5 bg-white/5 p-3">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="font-medium text-amber-200">{risk.risk}</span>
                        {renderDataStatus(risk.dataStatus)}
                      </div>
                      <p className="mb-2 text-xs opacity-80">{risk.evidence.join(' ')}</p>
                      <div className="text-xs text-cyan-200/80">Action: {risk.action}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 font-semibold text-foreground">Crop Comparison & Rankings</h3>
              <Accordion type="single" collapsible className="w-full">
                {report.cropComparisons.map((comp: any) => {
                  const realRec = analysis.recommendations.find((r: any) => 
                    r.crop.toLowerCase() === comp.crop.toLowerCase() ||
                    comp.crop.toLowerCase().includes(r.crop.toLowerCase()) ||
                    r.crop.toLowerCase().includes(comp.crop.toLowerCase())
                  );
                  const rank = realRec ? realRec.rank : comp.rank;
                  const score = realRec ? realRec.score : comp.score;
                  
                  return (
                  <AccordionItem key={comp.crop} value={comp.crop} className="border-white/10">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex w-full items-center justify-between pr-4">
                        <span className="font-medium text-emerald-300">
                          #{rank} {comp.crop} {score !== undefined && `(Score: ${score})`}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      <div className="space-y-3 pt-2">
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Strengths:</span>
                          <ul className="ml-4 list-disc text-xs">
                            {comp.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Concerns:</span>
                          <ul className="ml-4 list-disc text-xs">
                            {comp.concerns.map((s: string, i: number) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                        <div className="rounded bg-white/5 p-2 text-xs italic opacity-80">
                          {comp.evidence.join(' ')}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 font-semibold text-foreground">Rotation Insights</h3>
                <ul className="ml-4 list-disc text-xs space-y-1">
                  {report.rotationInsights.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-foreground">Practical Next Steps</h3>
                <ul className="ml-4 list-disc text-xs space-y-1">
                  {report.nextSteps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-white/5 bg-black/20 p-3 text-xs">
              <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                <Database className="size-3" /> Data Confidence & Limitations
              </div>
              <ul className="ml-4 list-disc space-y-1 opacity-80">
                {report.dataLimitations.map((l: string, i: number) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          </div>
        )}
      </Card>

      <Card className="flex flex-col border-white/10 bg-card/50 overflow-hidden" style={{ height: '400px' }}>
        <div className="flex items-center gap-2 border-b border-white/5 p-4 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80">
          <BrainCircuit className="size-4" />
          Ask Your Field
        </div>
        
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center opacity-50">
                <BrainCircuit className="mb-2 size-8" />

                <p className="text-sm">Ask anything about this field's analysis, crop rankings, or risks.</p>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    m.role === 'user' 
                      ? 'bg-emerald-500/20 text-emerald-100 rounded-tr-sm' 
                      : 'bg-white/10 text-foreground rounded-tl-sm'
                  }`}>
                    <div className="text-sm space-y-3 leading-relaxed"><ReactMarkdown 
  components={{
    h1: ({node, ...props}) => <h1 className="text-lg font-bold mt-4 mb-2" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-base font-bold mt-3 mb-2" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-sm font-bold mt-2 mb-1" {...props} />,
    p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc ml-5 space-y-1 mb-2 leading-relaxed" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal ml-5 space-y-1 mb-2 leading-relaxed" {...props} />,
    li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
    strong: ({node, ...props}) => <strong className="font-semibold text-emerald-200" {...props} />,
    em: ({node, ...props}) => <em className="italic opacity-90" {...props} />
  }}
>
  {m.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') || ''}
</ReactMarkdown></div>
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-white/10 px-4 py-2 text-sm text-foreground">
                  <Loader2 className="size-3 animate-spin" /> Thinking...
                </div>
              </div>
            )}
            {chatError && (
              <div className="flex justify-center text-xs text-red-400">
                An error occurred. Please try again.
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="border-t border-white/5 p-3">
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            // @ts-ignore
            sendMessage({ text: input });
            setInput('');
          }} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Why is water availability a concern?"
              className="border-white/10 bg-black/20"
              disabled={chatLoading}
            />
            <Button type="submit" disabled={chatLoading || !input.trim()} size="icon" className="bg-emerald-600 hover:bg-emerald-500 text-white">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useMealPlanChat } from '@/hooks/useMealPlanChat';


export default function MealPlanChatBox() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, isLoading, sendMessage, planApplied } = useMealPlanChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Chat panel */}
      {open && (
        <div className="w-[380px] h-[520px] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-primary text-primary-foreground rounded-t-2xl">
            <Bot className="h-4 w-4 shrink-0" />
            <span className="font-medium text-sm flex-1">Meal Plan Assistant</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Plan-applied banner */}
          {planApplied && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border-b border-green-200 text-green-800 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
              <span>
                Plan applied to the planner above. Review it, then click{' '}
                <strong>Finalize</strong> when you're happy!
              </span>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 px-3 py-3">
            <div className="flex flex-col gap-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Loading dots */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-muted-foreground flex gap-1 items-center">
                    <span className="animate-bounce [animation-delay:0ms]">·</span>
                    <span className="animate-bounce [animation-delay:150ms]">·</span>
                    <span className="animate-bounce [animation-delay:300ms]">·</span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Suggestion chips (show only on first message) */}
          {messages.length === 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {[
                '4 days Chinese, 3 days Italian',
                'What's on Monday?',
                'Total calories this week?',
              ].map(chip => (
                <button
                  key={chip}
                  onClick={() => { setInput(chip); }}
                  className="text-xs px-2 py-1 rounded-full border border-border hover:bg-muted transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="border-t px-3 py-3">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question or describe a plan…"
                className="flex-1 text-sm"
                disabled={isLoading}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating toggle button — shows sparkle badge when plan was just applied */}
      <div className="relative">
        {planApplied && !open && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
        )}
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={() => setOpen(v => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}

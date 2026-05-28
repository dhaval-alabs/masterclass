'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

interface QualificationChatProps {
  registrationId?: string;
  email?: string;
  phone?: string;
  name?: string;
  city?: string;
  /** When provided the component hands the conversation to the parent instead of
   *  calling /api/qualify itself. The parent calls the API after OTP verification. */
  onComplete?: (conversation: Message[]) => void;
}

const QUESTIONS: string[] = [
  'Quick one — currently working or studying?',
  "What's pulling you toward data and AI right now?",
  'When are you looking to upskill — next few months, or still exploring?',
  'Bangalore, Gurugram, or Noida?',
  "Last thing — the masterclass details and a reminder will come straight to your WhatsApp. Shall I lock in your spot?",
];

const QUESTION_OPTIONS: readonly string[][] = [
  ['Working full-time', 'Working part-time', 'Studying', 'Between jobs'],
  ['Switch to data career', 'Upskill / get promoted', 'Business analytics', 'Just curious'],
  ['Within 1–2 months', '3–4 months', '5–6 months', 'Still exploring'],
  ['Bangalore', 'Gurugram', 'Noida', 'Online mode'],
  ["Yes, lock me in!", 'I have a question first', 'Not right now'],
];

const navy = '#09263F';
const teal = '#1DE5B5';

export default function QualificationChat({
  registrationId,
  email,
  phone,
  name,
  city,
  onComplete,
}: QualificationChatProps) {
  const firstName = name ? name.split(' ')[0] : 'there';

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi ${firstName}! 👋 Just a few quick questions so I can personalise your experience. Takes under 2 minutes.`,
    },
    { role: 'assistant', content: QUESTIONS[0] },
  ]);
  const [input, setInput] = useState('');
  const [questionIndex, setQuestionIndex] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [score, setScore] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function fetchAck(question: string, answer: string, qIndex: number): Promise<string> {
    try {
      const res = await fetch('/api/chat/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer, questionIndex: qIndex }),
      });
      const data = await res.json() as { ack?: string };
      return data.ack?.trim() ?? '';
    } catch {
      return '';
    }
  }

  async function handleSend(directText?: string) {
    const trimmed = (directText ?? input).trim();
    if (!trimmed || isSubmitting || isComplete) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!directText) setInput('');
    setIsSubmitting(true);

    // Build the scored conversation — only Q&A pairs, no UI-only messages
    const conversationSoFar = updatedMessages.filter(
      m => m.role === 'user' || QUESTIONS.includes(m.content),
    );

    if (questionIndex < QUESTIONS.length) {
      // Get a brief Gemini acknowledgment before the next question
      const ack = await fetchAck(QUESTIONS[questionIndex - 1], trimmed, questionIndex);
      const nextQ = QUESTIONS[questionIndex];

      setMessages(prev => [
        ...prev,
        ...(ack ? [{ role: 'assistant' as const, content: ack }] : []),
        { role: 'assistant' as const, content: nextQ },
      ]);
      setQuestionIndex(prev => prev + 1);
      setIsSubmitting(false);
    } else {
      if (onComplete) {
        // Pre-OTP mode: hand conversation to parent — parent calls /api/qualify after OTP
        setIsComplete(true);
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: "Perfect — sending your OTP now. 🎉" },
        ]);
        onComplete(conversationSoFar);
      } else {
        // Thank-you page mode: call /api/qualify directly
        try {
          const res = await fetch('/api/qualify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationId, email, phone, name, city, conversation: conversationSoFar }),
          });
          const data = await res.json() as { score?: string };
          setScore(data.score ?? null);
        } catch {
          // silent — qualification is non-blocking
        } finally {
          setIsComplete(true);
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content:
                "Thank you! Our team will be in touch with personalised guidance based on what you've shared. You're all set! 🎉",
            },
          ]);
        }
      }
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const completionColor =
    score === 'hot'  ? '#16a34a' :
    score === 'warm' ? '#ca8a04' :
    score === 'cold' ? '#2563eb' :
    score === 'junk' ? '#9ca3af' :
    teal;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.85)',
        border: '1.5px solid #e0eeeb',
        borderRadius: '20px',
        padding: '28px 24px',
        boxShadow: '0 4px 24px rgba(9,38,63,0.05)',
        maxWidth: '640px',
        margin: '0 auto',
      }}
    >
      <div style={{ marginBottom: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#4A6275', margin: 0 }}>
          Help us personalise your counselling session
        </p>
      </div>

      {/* Chat messages */}
      <div
        ref={messagesContainerRef}
        style={{
          height: '300px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: '16px',
          padding: '4px 0',
        }}
      >
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? navy : '#f0faf8',
                color: msg.role === 'user' ? '#fff' : navy,
                fontSize: '14px',
                lineHeight: 1.5,
                border: msg.role === 'assistant' ? '1px solid #D6ECEB' : 'none',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isSubmitting && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '18px 18px 18px 4px',
                background: '#f0faf8',
                border: '1px solid #D6ECEB',
                fontSize: '20px',
                color: '#4A6275',
                letterSpacing: '4px',
              }}
            >
              ···
            </div>
          </div>
        )}
      </div>

      {/* Quick-reply option buttons for the current question */}
      {!isComplete && !isSubmitting && QUESTION_OPTIONS[questionIndex - 1] && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {QUESTION_OPTIONS[questionIndex - 1].map(opt => (
            <button
              key={opt}
              onClick={() => handleSend(opt)}
              style={{
                background: '#f0faf8',
                border: `1.5px solid ${teal}`,
                borderRadius: '999px',
                padding: '6px 14px',
                fontSize: '13px',
                color: navy,
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#d6f5ee')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f0faf8')}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Free-text input */}
      {!isComplete ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Or type your own answer…"
            rows={2}
            style={{
              flex: 1,
              resize: 'none',
              border: '1.5px solid #D6ECEB',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '14px',
              fontFamily: 'inherit',
              color: navy,
              outline: 'none',
              background: '#fff',
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isSubmitting}
            style={{
              background: teal,
              color: navy,
              border: 'none',
              borderRadius: '12px',
              padding: '10px 18px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: input.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !isSubmitting ? 1 : 0.5,
              transition: 'opacity 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            Send →
          </button>
        </div>
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '12px',
            background: '#f0faf8',
            borderRadius: '12px',
            border: '1px solid #D6ECEB',
            fontSize: '13px',
            color: completionColor,
            fontWeight: 600,
          }}
        >
          Your responses have been saved. We&apos;ll be in touch soon!
        </div>
      )}
    </div>
  );
}

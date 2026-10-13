import React, { useState } from 'react';
import { api } from '../utils/api';
import { Star } from 'lucide-react';

export default function PlatformReviewForm({
  defaultRating = 5,
  defaultContent = '',
  isUpdate = false,
  onSuccess
}: {
  defaultRating?: number;
  defaultContent?: string;
  isUpdate?: boolean;
  onSuccess?: () => void;
}) {
  const [rating, setRating] = useState(defaultRating);
  const [content, setContent] = useState(defaultContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.length < 10) {
      setError('Review must be at least 10 characters.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await api.post('/me/review', { rating, content });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Could not submit review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stack" style={{ gap: 14 }}>
      {error && <div style={{ color: 'var(--bad)', fontSize: '0.8125rem' }}>{error}</div>}
      <div>
        <label className="label" style={{ marginBottom: 4, display: 'block' }}>Rating</label>
        <div className="row" style={{ gap: 4 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              style={{
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: 'pointer'
              }}
            >
              <Star
                className="w-5 h-5"
                style={{
                  fill: star <= rating ? '#eab308' : 'transparent',
                  color: star <= rating ? '#eab308' : 'var(--ink-4)',
                  transition: 'color 0.2s, fill 0.2s'
                }}
              />
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="label">Your Review</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Tell us about your experience..."
          rows={3}
          className="input"
          style={{ resize: 'vertical' }}
        />
        <span className="field-hint">Minimum 10 characters.</span>
      </label>
      <button type="submit" disabled={isSubmitting || content.length < 10} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
        {isSubmitting ? 'Submitting…' : (isUpdate ? 'Update Review' : 'Submit Review')}
      </button>
    </form>
  );
}

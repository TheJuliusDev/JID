import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  size?: number;
  interactive?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}

/**
 * Star rating display + optional input. In interactive mode the user can hover
 * and click to pick 1–5; otherwise it renders a rounded read-only average.
 */
export const StarRating: React.FC<StarRatingProps> = ({
  value,
  size = 16,
  interactive = false,
  onChange,
  className,
}) => {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className={`inline-flex items-center gap-0.5 ${className || ''}`} role={interactive ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(display);
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onMouseEnter={() => interactive && setHover(star)}
            onMouseLeave={() => interactive && setHover(0)}
            onClick={() => interactive && onChange?.(star)}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            aria-checked={interactive ? star === Math.round(value) : undefined}
            role={interactive ? 'radio' : undefined}
          >
            <Star
              style={{ width: size, height: size }}
              className={filled ? 'text-amber-400 fill-amber-400' : 'text-zinc-300 dark:text-zinc-600'}
            />
          </button>
        );
      })}
    </div>
  );
};

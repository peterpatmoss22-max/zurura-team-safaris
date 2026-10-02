use client';

import React, { useState } from 'react';

export default function StarRating({ totalStars = 5 }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[...Array(totalStars)].map((_, index) => {
        const starValue = index + 1;
        return (
          <button
            key={starValue}
            type="button"
            onClick={() => setRating(starValue)}
            onMouseEnter={() => setHover(starValue)}
            onMouseLeave={() => setHover(0)}
            className="background-none border-none cursor-pointer text-3xl transition-colors duration-200"
            style={{
              color: starValue <= (hover || rating) ? '#ffc107' : '#e4e5e9',
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

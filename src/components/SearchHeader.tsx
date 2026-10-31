import React from 'react';
import { useNavigate } from 'react-router-dom';

export const SearchHeader: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <header className="top rv" style={{ ['--n' as string]: 0 }}>
      <button className="ic bk" aria-label="Back" onClick={handleBack} style={{ position: 'absolute', left: 'calc(var(--rail) + 1.25rem)', zIndex: 10 }}>
        <svg className="i">
          <use href="#al" />
        </svg>
      </button>
      <div className="brand">
        <span className="logo">M</span>
        <span>Mad<b>Hata</b></span>
      </div>
    </header>
  );
};

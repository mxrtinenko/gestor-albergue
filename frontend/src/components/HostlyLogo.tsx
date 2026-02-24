import React from "react";

interface HostlyLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

const HostlyLogo: React.FC<HostlyLogoProps> = ({ size = 40, showText = true, className = "" }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Concha de Santiago stylized */}
        <path
          d="M32 4C32 4 8 28 8 44C8 52 18 60 32 60C46 60 56 52 56 44C56 28 32 4 32 4Z"
          fill="hsl(47, 68%, 45%)"
          opacity="0.15"
        />
        <path
          d="M32 8L32 56"
          stroke="hsl(47, 68%, 45%)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M32 12C32 12 14 32 12 44C12 50 20 56 32 56"
          stroke="hsl(47, 68%, 45%)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M32 12C32 12 50 32 52 44C52 50 44 56 32 56"
          stroke="hsl(47, 68%, 45%)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M32 18C32 18 18 34 16 44C16 48 22 54 32 54"
          stroke="hsl(47, 68%, 45%)"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M32 18C32 18 46 34 48 44C48 48 42 54 32 54"
          stroke="hsl(47, 68%, 45%)"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M32 26C32 26 22 38 20 44C20 47 25 52 32 52"
          stroke="hsl(47, 68%, 45%)"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
        <path
          d="M32 26C32 26 42 38 44 44C44 47 39 52 32 52"
          stroke="hsl(47, 68%, 45%)"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
      </svg>
      {showText && (
        <div className="flex flex-col">
          <span className="font-display text-xl font-bold leading-tight text-gold">
            Hostly
          </span>
        </div>
      )}
    </div>
  );
};

export default HostlyLogo;

import React from 'react';

interface JDCurrencyIconProps {
  className?: string;
}

/**
 * A custom Jordanian Dinar (JD) currency icon component
 * that can be used as a drop-in replacement for the Lucide DollarSign component.
 */
export const JDCurrencyIcon: React.FC<JDCurrencyIconProps> = ({ className }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Base structure similar to currency icons */}
      <circle cx="12" cy="12" r="8" />
      
      {/* JD text in the center */}
      <text
        x="12"
        y="16"
        fontFamily="Arial, sans-serif"
        fontSize="10"
        fontWeight="bold"
        textAnchor="middle"
        fill="currentColor"
      >
        JD
      </text>
    </svg>
  );
};

export default JDCurrencyIcon;
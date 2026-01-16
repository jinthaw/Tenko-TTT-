import React from 'react';

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div 
    className={`bg-white rounded-xl shadow-sm p-6 border border-slate-100 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
    onClick={onClick}
  >
    {children}
  </div>
);

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', isLoading, className = '', ...props }) => {
  const baseStyle = "rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-2.5",
    lg: "px-8 py-3 text-lg"
  };

  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg shadow-blue-200",
    secondary: "bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50",
    danger: "bg-red-500 text-white hover:bg-red-600",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100"
  };

  return (
    <button 
      className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className}`} 
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <i className="fas fa-circle-notch fa-spin"></i>}
      {children}
    </button>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: boolean;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-semibold mb-2 text-slate-700">{label}</label>}
    <input 
      className={`w-full px-4 py-2.5 rounded-lg border-2 text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100 ${error ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-blue-500'} ${className}`}
      {...props}
    />
  </div>
);

// --- Badge ---
export const Badge: React.FC<{ children: React.ReactNode; type?: 'pending' | 'approved' | 'danger' | 'neutral' }> = ({ children, type = 'neutral' }) => {
  const styles = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    danger: "bg-red-100 text-red-800",
    neutral: "bg-slate-100 text-slate-600"
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${styles[type]}`}>
      {children}
    </span>
  );
};

// --- Option Button ---
export const OptionButton: React.FC<{ selected: boolean; onClick: () => void; children: React.ReactNode }> = ({ selected, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
      selected 
        ? 'border-blue-500 bg-blue-500 text-white shadow-md' 
        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:bg-slate-50'
    }`}
  >
    {children}
  </button>
);
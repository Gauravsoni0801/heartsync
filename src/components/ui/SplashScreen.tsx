import { Heart } from 'lucide-react';

export const SplashScreen = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
      {/* Custom Heartbeat Animation */}
      <style>
        {`
          @keyframes heartbeat {
            0%, 100% { transform: scale(1); }
            10% { transform: scale(1.15); }
            20% { transform: scale(1); }
            30% { transform: scale(1.15); }
            40% { transform: scale(1); }
          }
          .animate-heartbeat {
            animation: heartbeat 1.5s ease-in-out infinite;
          }
        `}
      </style>

      {/* The Glowing Heart */}
      <div className="relative mb-8">
        <div className="absolute -inset-6 bg-pink-600/20 rounded-full blur-3xl animate-pulse"></div>
        <Heart 
          className="relative w-24 h-24 text-pink-500 fill-pink-500 animate-heartbeat"
          style={{ filter: 'drop-shadow(0 15px 25px rgba(236, 72, 153, 0.4))' }}
        />
      </div>

      {/* Brand Text */}
      <div className="text-center space-y-3 relative z-10">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-600 tracking-tight">
          HeartSync
        </h1>
        <div className="flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        <p className="text-zinc-500 text-sm font-medium tracking-widest uppercase mt-2">
          Securing Connection
        </p>
      </div>
    </div>
  );
};
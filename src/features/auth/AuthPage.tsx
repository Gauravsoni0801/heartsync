import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../lib/supabase/client'; 
import { useNavigate } from 'react-router-dom';

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  display_name: z.string().min(2, "Name is required for signup").optional(),
  dob: z.string().refine((date) => {
    if (!date) return true; // Login mode ke liye bypass
    const birthDate = new Date(date);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  }, { message: "You must be at least 18 years old to join HeartSync" }).optional(),
});

type AuthFormData = z.infer<typeof authSchema>;

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
  });

  const onSubmit = async (data: AuthFormData) => {
    setLoading(true);
    setError(null);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (error) throw error;
        navigate('/');
      } else {
        // Essential Signup Check
        if (!data.display_name || !data.dob) {
          setError("All fields are mandatory for Sign Up");
          setLoading(false);
          return;
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              display_name: data.display_name,
              dob: data.dob,
              timezone,
            },
          },
        });

        if (signUpError) throw signUpError;

        // Auto-login check
        if (signUpData.session) {
          navigate('/');
        } else {
          alert("Success! Check your email or try logging in.");
          setIsLogin(true);
          reset();
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    reset();
  };

  return (
    <div className="flex justify-center items-center h-screen bg-neutral-950 text-neutral-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-pink-900/10 via-transparent to-transparent pointer-events-none" />
      
      <form onSubmit={handleSubmit(onSubmit)} className="relative p-8 border border-neutral-800 rounded-2xl shadow-2xl w-[400px] bg-neutral-900/80 backdrop-blur-xl">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-400">
            {isLogin ? 'Welcome Back' : 'HeartSync'}
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            {isLogin ? 'Connect with your partner' : 'Start your shared journey'}
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 text-red-400 text-xs rounded-lg animate-pulse">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="group">
            <label className="text-[11px] uppercase tracking-wider text-neutral-500 ml-1 mb-1 block group-focus-within:text-pink-500 transition-colors">Email Address</label>
            <input 
              {...register('email')} 
              placeholder="name@example.com" 
              className="w-full p-3 rounded-xl bg-neutral-800/50 border border-neutral-700 outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all placeholder:text-neutral-600" 
            />
            {errors.email && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.email.message}</p>}
          </div>

          <div className="group">
            <label className="text-[11px] uppercase tracking-wider text-neutral-500 ml-1 mb-1 block group-focus-within:text-pink-500 transition-colors">Password</label>
            <input 
              {...register('password')} 
              type="password" 
              placeholder="••••••••" 
              className="w-full p-3 rounded-xl bg-neutral-800/50 border border-neutral-700 outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all placeholder:text-neutral-600" 
            />
            {errors.password && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.password.message}</p>}
          </div>

          {!isLogin && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="group">
                <label className="text-[11px] uppercase tracking-wider text-neutral-500 ml-1 mb-1 block group-focus-within:text-pink-500 transition-colors">Full Name</label>
                <input 
                  {...register('display_name')} 
                  placeholder="Your Name" 
                  className="w-full p-3 rounded-xl bg-neutral-800/50 border border-neutral-700 outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all placeholder:text-neutral-600" 
                />
                {errors.display_name && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.display_name.message}</p>}
              </div>

              <div className="group">
                <label className="text-[11px] uppercase tracking-wider text-neutral-500 ml-1 mb-1 block group-focus-within:text-pink-500 transition-colors">Date of Birth</label>
                <input 
                  {...register('dob')} 
                  type="date" 
                  className="w-full p-3 rounded-xl bg-neutral-800/50 border border-neutral-700 outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all text-neutral-300 appearance-none" 
                />
                {errors.dob && <p className="text-red-400 text-[10px] mt-1 ml-1">{errors.dob.message}</p>}
              </div>
            </div>
          )}
        </div>

        <button 
          disabled={loading} 
          type="submit" 
          className="w-full bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white p-3 rounded-xl font-bold transition-all disabled:opacity-50 mt-8 shadow-lg shadow-pink-500/20 active:scale-[0.98]"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Processing...
            </span>
          ) : (isLogin ? 'Sign In' : 'Create Account')}
        </button>

        <p className="mt-6 text-center text-sm text-neutral-500">
          {isLogin ? "New to HeartSync?" : "Already a member?"}
          <button 
            type="button" 
            onClick={toggleMode} 
            className="ml-2 text-pink-500 hover:text-pink-400 font-semibold transition-colors underline-offset-4 hover:underline"
          >
            {isLogin ? 'Sign up' : 'Login'}
          </button>
        </p>
      </form>
    </div>
  );
};
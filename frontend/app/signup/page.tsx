'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/client";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ฟังก์ชันสมัครด้วย Email/Password
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccessMsg("");

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { display_name: username },
        // ถ้าใช้ email confirm ตอนคลิกลิ้งก์จากอีเมลให้วิ่งมาที่นี่
        emailRedirectTo: `${window.location.origin}/auth/callback`, 
      },
    });

    if (error) {
      console.error("Full Error Object:", error);
      setError(error.message);
      setIsLoading(false);
    } else {
      // ถ้าเปิด Email Verification ไว้ data.session จะเป็น null
      if (data.user && !data.session) {
        setSuccessMsg("สมัครสำเร็จ! กรุณาตรวจสอบอีเมลของคุณเพื่อยืนยันการสมัคร (ถ้าทำ Local ให้ไปดูที่ localhost:54324)");
        setIsLoading(false);
      } else if (data.session) {
        // กรณีที่ไม่ได้เปิด Email Confirm
        alert("Register successful!");
        router.push("/");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError("");
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setIsGoogleLoading(false);
    }
    // ตัวนี้ไม่ต้อง redirect เอง เพราะ supabase จะเด้งไปหน้า Google ทันที
  };

  return (
    <div className="w-full h-screen lg:grid lg:grid-cols-2">
      {/* LeftSide: Form Register */}
      <div className="flex items-center justify-center py-12 px-8 bg-white overflow-y-auto">
        <div className="mx-auto grid w-[400px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold text-slate-900">Create an Account</h1>
            <p className="text-balance text-muted-foreground">
              Enter your information to get started
            </p>
          </div>

          {/* ปุ่ม Sign up with Google */}
          <Button 
            variant="outline" 
            type="button" 
            onClick={handleGoogleSignIn} 
            disabled={isGoogleLoading || isLoading}
            className="w-full font-semibold"
          >
            {isGoogleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Sign up with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
          
          <form className="grid gap-4" onSubmit={handleSignUp}>
            {/* Name Field */}
            <div className="grid gap-2">
              <Label htmlFor="name">User Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {/* Email Field */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@gmail.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password Field */}
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            {/* Messages */}
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            {successMsg && <p className="text-sm text-green-600 text-center bg-green-50 p-3 rounded-md border border-green-200">{successMsg}</p>}

            {/* Register Button */}
            <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
            
            {/* Divider / Login Link */}
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/" className="underline font-medium hover:text-primary">
                Login
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* RightSide: Show Image */}
      <div className="hidden bg-slate-100 lg:block relative">
        <Image
          src="/images/3dpc.png"
          alt="LiDAR Point Cloud Visualization"
          fill
          className="object-cover grayscale hover:grayscale-0 transition-all duration-500"
          priority
        />
        <div className="absolute bottom-10 left-10 text-white z-10 p-6 bg-black/50 backdrop-blur-sm rounded-xl max-w-md">
            <h3 className="font-bold text-xl">Join the Platform</h3>
            <p className="text-sm opacity-90">
                Create an account to start managing your Point Cloud Distance Estimation projects today.
            </p>
        </div>
      </div>
    </div>
  );
}
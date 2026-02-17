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
  const [error, setError] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { display_name: username }
      },
    });

    if (error) {
      console.error("Full Error Object:", error);
      setError(error.message);
      setIsLoading(false);
    } else {
      if (data.session) {
        alert("Register successful!");
        router.push("/");
      }else {
        setIsLoading(false);
      } 
    }
  };

  return (
    <div className="w-full h-screen lg:grid lg:grid-cols-2">
      
      {/* LeftSide: Form Register */}
      <div className="flex items-center justify-center py-12 px-8 bg-white">
        <div className="mx-auto grid w-[400px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold text-slate-900">Create an Account</h1>
            <p className="text-balance text-muted-foreground">
              Enter your information to get started
            </p>
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
            
            {/* Error Message */}
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            {/* Register Button */}
            <Button type="submit" className="w-full" disabled={isLoading}>
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

      {/* RightSide: Show Image (Consistent with Login) */}
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
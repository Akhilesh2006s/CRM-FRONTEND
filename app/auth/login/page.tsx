'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Aurora from '@/components/Aurora'
import { GlassmorphismNav } from '@/components/glassmorphism-nav'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { login } from '@/lib/auth'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(mobile, password)
      toast.success('Welcome back! Redirecting…')
      
      // Redirect Executive Managers to their specific dashboard
      if (user.role === 'Executive Manager') {
        router.push(`/dashboard/executive-managers/${user._id}/dashboard`)
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed inset-0 w-full h-full">
        <Aurora colorStops={["#475569", "#64748b", "#475569"]} amplitude={2} blend={1} speed={0.8} />
      </div>
      <div className="relative z-10">
        <GlassmorphismNav />
        <main className="container mx-auto px-6 min-h-screen flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="w-full max-w-md"
          >
            <Card className="bg-neutral-900/70 border border-neutral-800 p-8 backdrop-blur-xl">
              <motion.h1
                className="text-3xl font-semibold text-white mb-6 text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                Sign in to C‑FORGIA
              </motion.h1>
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="mobile" className="text-gray-300">Mobile number or email</Label>
                  <Input
                    id="mobile"
                    type="text"
                    autoComplete="username"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                    placeholder="Mobile number or email"
                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-300">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute inset-y-0 right-0 px-3 text-sm text-neutral-300 hover:text-white"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
              <div className="text-sm text-neutral-400 mt-6 text-center">
                Don’t have an account?{' '}
                <Link href="/auth/register" className="text-blue-300 hover:text-blue-200">
                  Create one
                </Link>
              </div>
            </Card>
          </motion.div>
        </main>
      </div>
    </div>
  )
}



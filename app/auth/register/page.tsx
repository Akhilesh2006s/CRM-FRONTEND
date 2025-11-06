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
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { registerUser } from '@/lib/auth'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await registerUser({ name, email, password })
      toast.success('Account created! Redirecting…')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err?.message || 'Registration failed')
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
                Create your account
              </motion.h1>
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-300">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Jane Doe"
                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-300">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Creating…' : 'Create account'}
                </Button>
              </form>
              <div className="text-sm text-neutral-400 mt-6 text-center">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-blue-300 hover:text-blue-200">
                  Sign in
                </Link>
              </div>
            </Card>
          </motion.div>
        </main>
      </div>
      <Toaster richColors position="top-center" />
    </div>
  )
}



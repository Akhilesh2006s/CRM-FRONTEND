import { GlassmorphismNav } from "@/components/glassmorphism-nav"
import { HeroSection } from "@/components/hero-section"
import { ProblemSolutionSection } from "@/components/problem-solution-section"
import Aurora from "@/components/Aurora"
import { AITeamSection } from "@/components/ai-team-section"
import { TestimonialsSection } from "@/components/testimonials-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"

// CRM central feature block (adapted from Design-landing, with CRM focus)

function PricingSection() {
  return (
    <section id="pricing" className="container mx-auto px-6 py-16 md:py-24 flex flex-col items-center justify-center">
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 text-white">Pricing</h2>
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl justify-center">
        {/* Monthly Plan */}
        <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-8 shadow hover:shadow-lg transition-all">
          <h3 className="text-xl font-semibold mb-2 text-white text-center">Monthly Plan</h3>
          <div className="text-center text-4xl font-bold text-blue-400 mb-2">₹1,999</div>
          <div className="text-center text-sm text-gray-400 mb-6">per month, billed monthly</div>
          <ul className="text-gray-200 space-y-2 mb-4 text-sm">
            <li>All CRM core features</li>
            <li>Unlimited contacts & deals</li>
            <li>Up to 5 user seats</li>
            <li>Email & chat support</li>
            <li>Integrations: Google, Slack, Outlook</li>
          </ul>
        </div>
        {/* 6 Months Plan */}
        <div className="flex-1 bg-neutral-800 border-2 border-blue-600 ring-2 ring-blue-800 rounded-xl p-8 shadow-lg scale-105 z-10">
          <h3 className="text-xl font-semibold mb-2 text-blue-200 text-center">6 Month Plan</h3>
          <div className="text-center text-4xl font-bold text-blue-100 mb-2">₹10,999</div>
          <div className="text-center text-sm text-blue-300 mb-6">billed every 6 months (₹1,833/mo)</div>
          <ul className="text-gray-200 space-y-2 mb-4 text-sm">
            <li>All CRM core features</li>
            <li>Everything in Monthly</li>
            <li>Up to 10 user seats</li>
            <li>Priority support</li>
            <li>API access</li>
          </ul>
          <div className="text-xs text-center text-blue-400 font-semibold">Popular</div>
        </div>
        {/* Yearly Plan */}
        <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-8 shadow hover:shadow-lg transition-all">
          <h3 className="text-xl font-semibold mb-2 text-white text-center">Yearly Plan</h3>
          <div className="text-center text-4xl font-bold text-blue-400 mb-2">₹18,999</div>
          <div className="text-center text-sm text-gray-400 mb-6">billed yearly (₹1,583/mo)</div>
          <ul className="text-gray-200 space-y-2 mb-4 text-sm">
            <li>All CRM core features</li>
            <li>Everything in 6 Months</li>
            <li>Up to 20 user seats</li>
            <li>Dedicated success manager</li>
            <li>Free onboarding assistance</li>
          </ul>
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-8 text-center max-w-md mx-auto">
        Most leading CRMs in India charge ₹2,000–₹7,000/month per user. C-FORGIA offers transparent, all-inclusive plans for teams at a fraction of that price—with no hidden fees.
      </div>
    </section>
  )
}

// Removed temporary IntegrationsSection

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      <main className="min-h-screen relative overflow-visible">
        <div className="fixed inset-0 w-full h-full">
          <Aurora colorStops={["#475569", "#64748b", "#475569"]} amplitude={2} blend={1} speed={0.8} />
        </div>
        <div className="relative z-10">
          <GlassmorphismNav />
          <HeroSection />
          <ProblemSolutionSection />
          {/* IntegrationsSection removed */}
          <PricingSection />
          <TestimonialsSection />
          <CTASection />
          <Footer />
        </div>
      </main>
    </div>
  )
}

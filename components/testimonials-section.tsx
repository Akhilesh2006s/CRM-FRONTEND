"use client"

import { useEffect, useRef } from "react"
import { TestimonialsColumn } from "@/components/ui/testimonials-column"

export function TestimonialsSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const elements = entry.target.querySelectorAll(".fade-in-element")
            elements.forEach((element, index) => {
              setTimeout(() => {
                element.classList.add("animate-fade-in-up")
              }, index * 300)
            })
          }
        })
      },
      { threshold: 0.1 },
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const testimonials = [
    {
      text:
        "C-FORGIA made pipeline tracking effortless. We went from scattered Excel sheets to a single CRM dashboard overnight—and our deal velocity doubled!",
      name: "Shriyasaswi",
      role: "Founder & CEO",
      company: "Amenity Forge"
    },
    {
      text:
        "Automated reminders, task assignments, and real-time analytics save our team hours every week. We've never closed deals faster.",
      name: "Madhav",
      role: "CTO",
      company: "Amenity Forge"
    },
    {
      text:
        "Integrating web and mobile touchpoints with C-FORGIA was seamless. Our sales reps now manage leads end-to-end from their phones.",
      name: "Akhilesh",
      role: "Web & Mobile Development Lead",
      company: "Amenity Forge"
    },
    {
      text:
        "Onboarding new sales hires is a breeze with C-FORGIA—we just add their email and they're productive in minutes!",
      name: "Ruchi Patel",
      role: "Regional Sales Manager",
      company: "Amenity Forge"
    },
    {
      text:
        "C-FORGIA’s customer support tracking system has made it easy to never miss a follow-up, boosting our client happiness to new highs.",
      name: "Alok Verma",
      role: "Customer Success Lead",
      company: "Amenity Forge"
    },
    {
      text:
        "We now run our pan-India team remotely and collaborate on deals through C-FORGIA's shared notes and notifications—productivity is way up.",
      name: "Priya Srinivasan",
      role: "National Accounts Director",
      company: "Amenity Forge"
    },
    {
      text:
        "Instant integration with Google Workspace and Slack meant zero headaches for IT—we were up and running by lunch the first day!",
      name: "Neeraj Biswas",
      role: "IT Systems Admin",
      company: "Amenity Forge"
    }
  ]

  return (
    <section id="testimonials" ref={sectionRef} className="relative pt-16 pb-16 px-4 sm:px-6 lg:px-8">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header Section - Keep as user loves it */}
        <div className="text-center mb-16 md:mb-32">
          <div className="fade-in-element opacity-0 translate-y-8 transition-all duration-1000 ease-out inline-flex items-center gap-2 text-white/60 text-sm font-medium tracking-wider uppercase mb-6">
            <div className="w-8 h-px bg-white/30"></div>
            Success Stories
            <div className="w-8 h-px bg-white/30"></div>
          </div>
          <h2 className="fade-in-element opacity-0 translate-y-8 transition-all duration-1000 ease-out text-5xl md:text-6xl lg:text-7xl font-light text-white mb-8 tracking-tight text-balance">
            The businesses we <span className="font-medium italic">empower</span>
          </h2>
          <p className="fade-in-element opacity-0 translate-y-8 transition-all duration-1000 ease-out text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            Discover how leading businesses are transforming their customer engagement with AI-powered chat solutions
          </p>
        </div>

        {/* Testimonials Carousel */}
        <div className="fade-in-element opacity-0 translate-y-8 transition-all duration-1000 ease-out relative flex justify-center items-center min-h-[600px] md:min-h-[800px] overflow-hidden">
          <div
            className="flex gap-8 max-w-6xl"
            style={{
              maskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
            }}
          >
            <TestimonialsColumn testimonials={testimonials.slice(0, 3)} duration={15} className="flex-1" />
            <TestimonialsColumn
              testimonials={testimonials.slice(2, 5)}
              duration={12}
              className="flex-1 hidden md:block"
            />
            <TestimonialsColumn
              testimonials={testimonials.slice(1, 4)}
              duration={18}
              className="flex-1 hidden lg:block"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

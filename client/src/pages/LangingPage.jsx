import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import {
  FiArrowRight,
  FiBell,
  FiBookOpen,
  FiBriefcase,
  FiCheck,
  FiChevronDown,
  FiFileText,
  FiGrid,
  FiMessageSquare,
  FiPlay,
  FiShield,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi'

const featureCards = [
  {
    icon: FiGrid,
    title: 'Smart Report Management',
    description: 'Organize submissions, milestones and approvals in one clear workflow.',
  },
  {
    icon: FiTrendingUp,
    title: 'AI-Powered Analysis',
    description: 'Get instant feedback, quality scores and plagiarism detection.',
  },
  {
    icon: FiUsers,
    title: 'Effortless Collaboration',
    description: 'Keep students, supervisors and institutions aligned in real time.',
  },
  {
    icon: FiShield,
    title: 'Secure & Reliable',
    description: 'Protected workflows with role-based access and decision logs.',
  },
  {
    icon: FiFileText,
    title: 'Meeting Management',
    description: 'Schedule check-ins, reminders and follow-ups without friction.',
  },
  {
    icon: FiBookOpen,
    title: 'Insights & Analytics',
    description: 'Track momentum, risk signals and completion trends over time.',
  },
  {
    icon: FiMessageSquare,
    title: 'Supervisor Feedback',
    description: 'Turn progress reviews into measurable improvement actions.',
  },
  {
    icon: FiBriefcase,
    title: 'Defense Preparation',
    description: 'Prepare students for presentations with structured review history.',
  },
]

const secondaryCards = [
  'Real-time Tracking',
  'AI Feedback',
  'Report Versioning',
  'Supervisor Approval',
  'Meeting Scheduling',
  'Progress Monitoring',
  'Notifications',
  'Analytics',
]

const trustLogos = ['LSE', 'NUS', 'ETH', 'MIT', 'Imperial', 'Harvard', 'Oxford', 'Monash']

const testimonials = [
  {
    name: 'Anne K.',
    role: 'Student',
    text: 'InternSmart made it easy to see where I stood at every stage. The AI feedback was practical and gave me clear, actionable next steps.',
    initials: 'AK',
  },
  {
    name: 'Mr. Kapnang.',
    role: 'Supervisor',
    text: 'The platform helps me review reports consistently, track student progress and keep every decision documented without losing time.',
    initials: 'JM',
  },
  {
    name: 'Dr. Claire N.',
    role: 'Program Director',
    text: 'We gained visibility across our entire internship pipeline. It feels premium, secure and deeply aligned with how modern academic teams work.',
    initials: 'CN',
  },
]

const milestoneData = [
  'Report Uploaded',
  'AI Analysis',
  'Supervisor Review',
  'Final Approval',
]

const progressRows = [
  { label: 'Structure', value: 85 },
  { label: 'Clarity', value: 90 },
  { label: 'Grammar', value: 88 },
  { label: 'Originality', value: 95 },
  { label: 'References', value: 86 },
]

function LandingPage() {
  const navigate = useNavigate()
  const [isScrolled, setIsScrolled] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [stats, setStats] = useState({ students: 0, supervisors: 0, institutions: 0 })
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY
      setScrollY(y)
      setIsScrolled(y > 24)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const targetValues = { students: 1200, supervisors: 300, institutions: 50 }
    const duration = 1700
    const start = performance.now()

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      setStats({
        students: Math.round(targetValues.students * eased),
        supervisors: Math.round(targetValues.supervisors * eased),
        institutions: Math.round(targetValues.institutions * eased),
      })

      if (progress < 1) {
        requestAnimationFrame(tick)
      }
    }

    requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          }
        })
      },
      { threshold: 0.18 }
    )

    const elements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .testimonial-card')
    elements.forEach((element) => observer.observe(element))

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const elements = document.querySelectorAll('.timeline-milestone')
    let current = 0

    const interval = setInterval(() => {
      setActiveStep(current)
      current = (current + 1) % elements.length
    }, 850)

    return () => clearInterval(interval)
  }, [])

  const dashboardTransform = {
    transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${Math.max(0, scrollY * 0.06)}px)`,
  }

  const handleMouseMove = (event) => {
    const element = event.currentTarget
    const rect = element.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    setTilt({
      x: (0.5 - py) * 6,
      y: (px - 0.5) * 8,
    })
  }

  return (
    <div className="landing-page">
      <div className="parallax-orb" style={{ left: '8%', top: '10%', width: '420px', height: '420px', background: 'rgba(255,122,0,0.16)' }} />
      <div className="parallax-orb" style={{ right: '10%', top: '18%', width: '380px', height: '380px', background: 'rgba(255,122,0,0.14)' }} />

      <header className="fixed inset-x-0 top-0 z-50">
        <nav
          className={`flex w-full items-center justify-between border-b border-white/10 bg-[#050608]/60 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8 ${
            isScrolled ? 'shadow-[0_10px_30px_rgba(0,0,0,0.25)]' : ''
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-orange-400/80 bg-orange-500/10 text-[0.7rem] font-bold text-orange-300 shadow-[0_0_18px_rgba(255,122,0,0.28)]">
              i
            </span>
            <span className="text-[1.13rem] font-bold tracking-[-0.03em] text-white">InternSmart</span>
          </div>

          <div className="hidden items-center gap-7 text-[0.92rem] text-white/75 md:flex">
            <a href="#home" className="transition hover:text-white">Home</a>
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#about" className="transition hover:text-white">About Us</a>
            <a href="#how-it-works" className="transition hover:text-white">How It Works</a>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
            <a href="#contact" className="transition hover:text-white">Contact</a>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/login')} type="button" className="hidden px-0 py-2 text-sm font-medium text-white/80 transition hover:text-white md:inline-flex">
              Log in
            </button>
            <button onClick={() => navigate('/login')} type="button" className="inline-flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-[#ff7a00] via-[#ff8a1c] to-[#ff9d3d] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(255,122,0,0.2)] transition hover:-translate-y-0.5 cursor-pointer">
              Get Started <FiArrowRight />
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section id="home" className="hero section">
          <div className="page-shell hero-shell">
            <div className="hero-copy reveal-left">
              

              <h1 className="hero-title">
                Supervise Smarter.<br />
                <span className="accent">Empower Futures.</span>
              </h1>

              <p className="hero-subtext">
                InternSmart helps students, supervisors and institutions manage reports, track
                progress, get AI insights and collaborate seamlessly.
              </p>

              <div className="hero-actions">
                <button onClick={() => navigate('/login')} type="button" className="primary-button large cursor-pointer">
                  Get Started Free <FiArrowRight />
                </button>
        
              </div>

              <div className="hero-stats">
                <div className="stat-item">
                  <span className="stat-number accent">{stats.students.toLocaleString()}+</span>
                  <span className="stat-label">Active Students</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{stats.supervisors.toLocaleString()}+</span>
                  <span className="stat-label">Supervisors</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{stats.institutions.toLocaleString()}+</span>
                  <span className="stat-label">Institutions</span>
                </div>
              </div>
            </div>

            <div className="hero-visual reveal-right" style={{ transform: `translateY(${scrollY * 0.08}px)` }}>
              <div className="hero-glow" />

              <div className="dashboard-panel" onMouseMove={handleMouseMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })} style={dashboardTransform}>
                <div className="dashboard-inner">
                  <div className="dashboard-header">
                    <div className="window-actions">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span>Dashboard</span>
                  </div>

                  <div className="dashboard-body">
                    <aside className="side-panel">
                      <h4>My Supervisors</h4>
                      <div className="supervisor-list">
                        <div className="supervisor">
                          <div>
                            <strong>Dr. Rossi</strong>
                            <span>Project Mentor</span>
                          </div>
                          <span className="status-pill">Online</span>
                        </div>
                        <div className="supervisor">
                          <div>
                            <strong>Prof. Lee</strong>
                            <span>Research Lead</span>
                          </div>
                          <span className="status-pill">Review</span>
                        </div>
                      </div>
                    </aside>

                    <main className="main-panel">
                      <div className="summary-grid">
                        <div className="summary-card">
                          <span className="label">Progress</span>
                          <strong className="orange">v38.43%</strong>
                        </div>
                        <div className="summary-card">
                          <span className="label">Reports</span>
                          <strong>2 / 2</strong>
                        </div>
                      </div>

                      <div className="timeline">
                        <h4>Internship Timeline</h4>
                        <div className="timeline-row active">
                          <span className="dot" />
                          <span className="text">Draft submitted</span>
                          <span className="tag">done</span>
                        </div>
                        <div className="timeline-row active">
                          <span className="dot" />
                          <span className="text">AI check</span>
                          <span className="tag">done</span>
                        </div>
                        <div className="timeline-row">
                          <span className="dot" />
                          <span className="text">Review ready</span>
                          <span className="tag">next</span>
                        </div>
                      </div>

                      <div className="approval-banner">
                        <span>Your report is fully approved</span>
                        <strong>✓</strong>
                      </div>
                    </main>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* <div className={`scroll-indicator ${isScrolled ? 'hidden' : ''}`}>
            <span className="chevron"><FiChevronDown /></span>
            <span>Scroll</span>
          </div> */}
        </section>

        <section id="features" className="section">
          <div className="page-shell">
            <div className="reveal">
              <p className="section-label">Powered by AI · Designed for impact</p>
              <h2 className="heading-xl">Everything you need,<br /><span className="accent">powered by AI.</span></h2>
              <p className="subheading">
                From smart report analysis to real-time collaboration, InternSmart gives you everything
                you need to work smarter, learn faster and achieve more.
              </p>
            </div>

            <div className="carousel-wrap reveal">
              <div className="carousel-track">
                {[...featureCards, ...featureCards].map((item, index) => {
                  const Icon = item.icon
                  return (
                    <article key={`${item.title}-${index}`} className="feature-card">
                      <div className="feature-icon">
                        <Icon />
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </article>
                  )
                })}
              </div>
            </div>

            <div className="carousel-wrap reverse reveal">
              <div className="carousel-track">
                {[...secondaryCards, ...secondaryCards].map((label, index) => (
                  <div key={`${label}-${index}`} className="feature-card" style={{ width: '220px', minHeight: '120px' }}>
                    <div className="feature-icon">
                      <FiArrowRight />
                    </div>
                    <h3>{label}</h3>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="section">
          <div className="page-shell product-grid">
            <div className="product-copy reveal-left">
              <p className="product-subtitle">See InternSmart in action</p>
              <h2>
                A seamless experience<br />
                designed for <span className="accent">everyone.</span>
              </h2>
              <p>
                From real-time progress tracking to AI insights, everything you need to succeed in one
                intelligent platform.
              </p>

              <div className="checklist">
                <div className="check-item"><span className="mark"><FiCheck /></span> Real-time progress tracking</div>
                <div className="check-item"><span className="mark"><FiCheck /></span> AI feedback &amp; suggestions</div>
                <div className="check-item"><span className="mark"><FiCheck /></span> Meeting scheduling &amp; reminders</div>
                <div className="check-item"><span className="mark"><FiCheck /></span> Role-based access &amp; permissions</div>
              </div>

              <button onClick={() => navigate('/login')} type="button" className="primary-button cursor-pointer">
                Explore Dashboard <FiArrowRight />
              </button>
            </div>

            <div className="dashboard-preview reveal-right">
              <div className="preview-panel">
                <div className="preview-topbar">
                  <span className='flex relative top-4 left-16'>AI Writing Score</span>
                  <span className="status-pill" >Live</span>
                </div>

                <div className="preview-graph">
                  <div className="mini-panel">
                    <div className="progress-ring">
                      <span>8.4</span>
                    </div>
                  </div>

                  <div className="mini-panel">
                    <div className="progress-bars">
                      {progressRows.map((row) => (
                        <div key={row.label} className="bar-row">
                          <span>{row.label}</span>
                          <div className="bar-track">
                            <span className="bar-fill" style={{ '--final-width': `${row.value}%` }} />
                          </div>
                          <strong>{row.value}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section steps-section" id="how-it-works">
          <div className="page-shell">
            <div className="reveal">
              <p className="section-label">How it works</p>
              <h2 className="heading-xl">From submission to approval,<br />without the complexity.</h2>
            </div>

            <div className="steps-grid reveal">
              {[
                { index: '01', title: 'Upload your report', description: 'Submit drafts, attachments and supporting files in minutes.' },
                { index: '02', title: 'AI analyzes your work', description: 'Review insights, clarity, originality and quality with rich scoring.' },
                { index: '03', title: 'Supervisor reviews & provides feedback', description: 'Leave comments, annotate and track suggestions in context.' },
                { index: '04', title: 'Track your progress to completion', description: 'Stay on top of milestones, alerts and final approval decisions.' },
              ].map((step) => (
                <article key={step.index} className="step-card">
                  <div className="step-index">{step.index}</div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>

            <div className="timeline-wrap reveal">
              <div className="vertical-line" />
              <div className="timeline-progress" style={{ height: `${((activeStep + 1) / milestoneData.length) * 100}%` }} />

              {milestoneData.map((item, idx) => (
                <div key={item} className={`timeline-milestone ${idx <= activeStep ? 'active' : ''}`}>
                  <span className="milestone-dot" />
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="pricing">
          <div className="page-shell">
            <div className="reveal">
              <p className="section-label">Loved by students and supervisors</p>
              <h2 className="heading-xl">Real people.<br />Real progress.</h2>
            </div>

            <div className="testimonials">
              {testimonials.map((person, index) => (
                <article
                  key={person.name}
                  className={`testimonial-card ${index === 0 ? 'left' : index === 1 ? 'center' : 'right'}`}
                >
                  <div className="avatar-row">
                    <div className="avatar">{person.initials}</div>
                    <div className="person">
                      <h4>{person.name}</h4>
                      <span>{person.role}</span>
                    </div>
                  </div>
                  <p>{person.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="cta-section section" id="contact">
          <div className="page-shell">
            <div className="cta-box reveal">
              <h2>Your internship. <span className="accent">Smarter than ever.</span></h2>
              <p>
                Join InternSmart and transform the way you manage, track and complete your internship.
              </p>

              <div className="cta-buttons">
                <button onClick={() => navigate('/login')} type="button" className="primary-button large cursor-pointer">Explore Dashboard <FiArrowRight /></button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-shell">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="brand">
                <span className="brand-mark">i</span>
                InternSmart
              </div>
              <p>
                A modern internship operating system for students, supervisors and institutions focused on
                progress, clarity and measurable outcomes.
              </p>
            </div>

            <div className="footer-column">
              <h4>Product</h4>
              <ul>
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><button onClick={() => navigate('/login')} className="hover:text-white transition text-left cursor-pointer">Login</button></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Company</h4>
              <ul>
                <li><a href="#about" className="hover:text-white transition">About Us</a></li>
                <li><a href="#contact" className="hover:text-white transition">Contact</a></li>
                <li><button onClick={() => navigate('/login')} className="hover:text-white transition text-left cursor-pointer">Portal Access</button></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Resources</h4>
              <ul>
                <li>Documentation</li>
                <li>Help Center</li>
                <li>Privacy</li>
                <li>Terms</li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Connect</h4>
              <div className="socials">
                <a href="#" aria-label="LinkedIn"><FiUsers /></a>
                <a href="#" aria-label="Messages"><FiMessageSquare /></a>
                <a href="#" aria-label="Notifications"><FiBell /></a>
              </div>
            </div>
          </div>

          <div>
            <span className="flex justify-center items-center">© 2026 InternSmart. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage

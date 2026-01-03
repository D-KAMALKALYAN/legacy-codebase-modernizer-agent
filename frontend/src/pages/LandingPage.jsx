import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Bot, 
  Zap, 
  Shield, 
  TrendingUp, 
  Code2, 
  FileSearch, 
  Sparkles,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

const LandingPage = () => {
  const features = [
    {
      icon: <Bot className="w-6 h-6" />,
      title: 'AI-Powered Analysis',
      description: 'Advanced AI models analyze your legacy code and provide actionable insights.',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Security Scanning',
      description: 'Detect vulnerabilities, SQL injections, XSS, and other security issues.',
      color: 'from-red-500 to-pink-500',
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Performance Optimization',
      description: 'Identify bottlenecks and get recommendations for better performance.',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: <Code2 className="w-6 h-6" />,
      title: 'Modern Standards',
      description: 'Convert outdated syntax to modern ES6+, TypeScript, and best practices.',
      color: 'from-purple-500 to-violet-500',
    },
    {
      icon: <FileSearch className="w-6 h-6" />,
      title: 'Detailed Reports',
      description: 'Get comprehensive Markdown reports with code examples and fixes.',
      color: 'from-orange-500 to-amber-500',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Lightning Fast',
      description: 'Cached results for instant analysis. Local LLM support for privacy.',
      color: 'from-yellow-500 to-orange-500',
    },
  ];

  const benefits = [
    'Upload code snippets, folders, or ZIP files',
    'AI analyzes security, performance, and code quality',
    'Get detailed reports with actionable recommendations',
    'Download reports in Markdown or PDF format',
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800">
              <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                AI-Powered Code Modernization
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-light-text dark:text-dark-text leading-tight">
              Transform Your
              <span className="text-gradient block mt-2">Legacy Code</span>
              with AI
            </h1>

            {/* Subheading */}
            <p className="text-xl md:text-2xl text-light-muted dark:text-dark-muted max-w-3xl mx-auto">
              Modernize your codebase with AI-powered analysis. 
              Detect security issues, improve performance, and adopt best practices.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link to="/register" className="btn btn-primary text-lg px-8 py-4 shadow-lg shadow-primary-500/50">
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
              <Link to="/login" className="btn btn-secondary text-lg px-8 py-4">
                Sign In
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-gradient">100%</div>
                <div className="text-sm text-light-muted dark:text-dark-muted mt-1">Free to Use</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-gradient"> &lt; 2s</div>
                <div className="text-sm text-light-muted dark:text-dark-muted mt-1">Cached Results</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-gradient">AI</div>
                <div className="text-sm text-light-muted dark:text-dark-muted mt-1">Powered</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-light-surface dark:bg-dark-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-light-text dark:text-dark-text mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-light-muted dark:text-dark-muted">
              Everything you need to modernize your legacy code
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="card card-hover p-6 space-y-4 group cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-light-text dark:text-dark-text">
                  {feature.title}
                </h3>
                <p className="text-light-muted dark:text-dark-muted">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-light-text dark:text-dark-text mb-4">
              How It Works
            </h2>
            <p className="text-xl text-light-muted dark:text-dark-muted">
              Four simple steps to modernize your code
            </p>
          </div>

          <div className="space-y-6 max-w-3xl mx-auto">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-start space-x-4 p-6 card animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-white font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <p className="text-lg text-light-text dark:text-dark-text">
                      {benefit}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/register" className="btn btn-primary text-lg px-8 py-4">
              Start Modernizing Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-light-border dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Bot className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              <span className="font-semibold text-light-text dark:text-dark-text">
                Legacy Modernizer
              </span>
            </div>
            <p className="text-sm text-light-muted dark:text-dark-muted">
              © 2025 Legacy Modernizer. Built with AI. Powered by Innovation.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, Menu, X, LogOut, Upload, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import ThemeToggle from '../ui/ThemeToggle';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsOpen(false);
  };

  return (
    <nav className="sticky top-0 z-40 glass border-b border-light-border dark:border-dark-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <Bot className="w-8 h-8 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <span className="text-xl font-bold text-gradient hidden sm:block">
              Legacy Modernizer
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="btn btn-ghost">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </Link>
                <Link to="/upload" className="btn btn-ghost">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Link>
                <div className="flex items-center space-x-3">
                  <div className="text-sm">
                    <p className="font-medium text-light-text dark:text-dark-text">{user?.name}</p>
                    <p className="text-light-muted dark:text-dark-muted text-xs">{user?.email}</p>
                  </div>
                  <button onClick={handleLogout} className="btn btn-ghost text-red-600">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">
                  Login
                </Link>
                <Link to="/register" className="btn btn-primary">
                  Get Started
                </Link>
              </>
            )}
            <ThemeToggle />
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center space-x-2">
            <ThemeToggle />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="btn btn-ghost p-2"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden border-t border-light-border dark:border-dark-border bg-light-elevated dark:bg-dark-surface animate-slide-down">
          <div className="px-4 py-4 space-y-3">
            {isAuthenticated ? (
              <>
                <div className="pb-3 border-b border-light-border dark:border-dark-border">
                  <p className="font-medium text-light-text dark:text-dark-text">{user?.name}</p>
                  <p className="text-light-muted dark:text-dark-muted text-sm">{user?.email}</p>
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-light-surface dark:hover:bg-dark-elevated transition-colors"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/upload"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-light-surface dark:hover:bg-dark-elevated transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  <span>Upload</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 w-full transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="block btn btn-ghost w-full text-left"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="block btn btn-primary w-full text-center"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
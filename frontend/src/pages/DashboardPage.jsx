import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Eye, 
  Upload,
  Search,
  Filter,
  AlertTriangle
} from 'lucide-react';
import { apiRequest, ENDPOINTS } from '../config/api';
import { formatDistanceToNow } from 'date-fns';
import GlobalLoader from '../components/ui/GlobalLoader';

const DashboardPage = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchJobs();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 350);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await apiRequest(ENDPOINTS.JOBS);
      if (response.success) {
        setJobs(response.data.jobs);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { icon: Clock, color: 'badge-info', text: 'Pending' },
      processing: { icon: Loader2, color: 'badge-warning', text: 'Processing', animate: true },
      completed: { icon: CheckCircle2, color: 'badge-success', text: 'Completed' },
      failed: { icon: XCircle, color: 'badge-error', text: 'Failed' },
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`badge ${badge.color} flex items-center space-x-1 flex-shrink-0`}>
        <Icon className={`w-3 h-3 ${badge.animate ? 'animate-spin' : ''}`} />
        <span className="whitespace-nowrap">{badge.text}</span>
      </span>
    );
  };

  const filteredJobs = jobs
    .filter((job) => {
      const searchableText = (job.originalFileName || job.fileName).toLowerCase();
      const matchesSearch = searchableText.includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || job.status === filterStatus;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (loading) {
    return <GlobalLoader message="Loading your jobs..." />;
  }

  // Screen size warning for small screens
  if (isSmallScreen) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-dark-card z-50 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-6xl mb-4">📱</p>
          <h2 className="text-2xl font-bold mb-2 text-light-text dark:text-dark-text">Screen Too Small</h2>
          <p className="text-light-muted dark:text-dark-muted">
            This app works best on tablets and desktops.<br />
            Please switch to a larger screen for the best experience.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-light-text dark:text-dark-text truncate">
              Your Analyses
            </h1>
            <p className="text-sm sm:text-base text-light-muted dark:text-dark-muted mt-1">
              {jobs.length} total {jobs.length === 1 ? 'analysis' : 'analyses'}
            </p>
          </div>
          <button
            onClick={() => navigate('/upload')}
            className="btn btn-primary w-full md:w-auto flex-shrink-0"
          >
            <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            <span className="whitespace-nowrap">New Analysis</span>
          </button>
        </div>

        {/* Filters */}
        <div className="card p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
          {/* Search */}
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-light-muted dark:text-dark-muted flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9 sm:pl-10 w-full text-sm sm:text-base"
            />
          </div>

          {/* Status Filter */}
          <div className="relative min-w-0 sm:w-auto">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-light-muted dark:text-dark-muted flex-shrink-0 pointer-events-none" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input pl-9 sm:pl-10 pr-8 sm:pr-10 appearance-none cursor-pointer w-full sm:w-auto text-sm sm:text-base"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {['completed', 'processing', 'pending', 'failed'].map((status) => {
            const count = jobs.filter((j) => j.status === status).length;
            return (
              <div key={status} className="card p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-light-muted dark:text-dark-muted capitalize truncate">
                      {status}
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-light-text dark:text-dark-text mt-1">
                      {count}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {getStatusBadge(status)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Jobs List */}
        {filteredJobs.length === 0 ? (
          <div className="card p-8 sm:p-12 text-center">
            <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-light-muted dark:text-dark-muted mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-light-text dark:text-dark-text mb-2">
              {searchTerm || filterStatus !== 'all' ? 'No matches found' : 'No analyses yet'}
            </h3>
            <p className="text-sm sm:text-base text-light-muted dark:text-dark-muted mb-6">
              {searchTerm || filterStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Upload your first code file to get started'}
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                onClick={() => navigate('/upload')}
                className="btn btn-primary"
              >
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Upload Code
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredJobs.map((job) => (
              <div
                key={job._id}
                className="card card-hover p-4 sm:p-6 cursor-pointer overflow-hidden"
                onClick={() => job.status === 'completed' && navigate(`/report/${job._id}`)}
              >
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4 gap-2 min-w-0">
                    <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 break-words min-w-0 flex-1">
                      {job.originalFileName || job.fileName}
                    </h3>
                    <div className="flex-shrink-0">
                      {getStatusBadge(job.status)}
                    </div>
                  </div>

                  <div className="space-y-3 text-sm flex-1">
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                      <span className="text-light-muted dark:text-dark-muted capitalize truncate">
                        {job.uploadType}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 min-w-0">
                      <Clock className="w-4 h-4 text-light-muted dark:text-dark-muted flex-shrink-0" />
                      <span className="text-light-text dark:text-dark-text text-xs truncate">
                        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {job.metadata?.totalIssues !== undefined && (
                      <div className="pt-2 border-t border-gray-200 dark:border-dark-border">
                        <p className="text-light-text dark:text-dark-text font-medium text-sm break-words">
                          {job.metadata.totalIssues} {job.metadata.totalIssues === 1 ? 'issue' : 'issues'}
                          {job.metadata.critical > 0 && (
                            <span className="text-red-500 ml-1">
                              ({job.metadata.critical} critical)
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {job.metadata?.cached && (
                      <div className="flex items-center space-x-1 text-green-600 dark:text-green-400 text-xs">
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                        <span>Cached</span>
                      </div>
                    )}
                  </div>

                  {job.status === 'failed' && job.errorMessage && (
                    <div className="flex items-start space-x-2 mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 overflow-hidden">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 dark:text-red-300 break-words min-w-0 flex-1">
                        {job.errorMessage}
                      </p>
                    </div>
                  )}

                  {job.status === 'completed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/report/${job._id}`);
                      }}
                      className="btn btn-secondary w-full mt-4 text-sm sm:text-base"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Report
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
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
  const navigate = useNavigate();

  useEffect(() => {
    fetchJobs();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
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
      <span className={`badge ${badge.color} flex items-center space-x-1`}>
        <Icon className={`w-3 h-3 ${badge.animate ? 'animate-spin' : ''}`} />
        <span>{badge.text}</span>
      </span>
    );
  };

  const filteredJobs = jobs
    .filter((job) => {
      const matchesSearch = job.fileName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || job.status === filterStatus;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (loading) {
    return <GlobalLoader message="Loading your jobs..." />;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">
              Your Analyses
            </h1>
            <p className="text-light-muted dark:text-dark-muted mt-1">
              {jobs.length} total {jobs.length === 1 ? 'analysis' : 'analyses'}
            </p>
          </div>
          <button
            onClick={() => navigate('/upload')}
            className="btn btn-primary"
          >
            <Upload className="w-5 h-5 mr-2" />
            New Analysis
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4 flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-light-muted dark:text-dark-muted" />
            <input
              type="text"
              placeholder="Search by filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-light-muted dark:text-dark-muted" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input pl-10 pr-10 appearance-none cursor-pointer"
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['completed', 'processing', 'pending', 'failed'].map((status) => {
            const count = jobs.filter((j) => j.status === status).length;
            return (
              <div key={status} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-light-muted dark:text-dark-muted capitalize">
                      {status}
                    </p>
                    <p className="text-2xl font-bold text-light-text dark:text-dark-text mt-1">
                      {count}
                    </p>
                  </div>
                  {getStatusBadge(status)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Jobs List */}
        {filteredJobs.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-light-muted dark:text-dark-muted mb-4" />
            <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-2">
              {searchTerm || filterStatus !== 'all' ? 'No matches found' : 'No analyses yet'}
            </h3>
            <p className="text-light-muted dark:text-dark-muted mb-6">
              {searchTerm || filterStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Upload your first code file to get started'}
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button
                onClick={() => navigate('/upload')}
                className="btn btn-primary"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload Code
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <div
                key={job._id}
                className="card card-hover p-6 cursor-pointer"
                onClick={() => job.status === 'completed' && navigate(`/report/${job._id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                      <h3 className="text-lg font-semibold text-light-text dark:text-dark-text truncate">
                        {job.fileName}
                      </h3>
                      {getStatusBadge(job.status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-light-muted dark:text-dark-muted">Type</p>
                        <p className="text-light-text dark:text-dark-text capitalize font-medium">
                          {job.uploadType}
                        </p>
                      </div>
                      <div>
                        <p className="text-light-muted dark:text-dark-muted">Created</p>
                        <p className="text-light-text dark:text-dark-text font-medium">
                          {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {job.metadata?.totalIssues !== undefined && (
                        <div>
                          <p className="text-light-muted dark:text-dark-muted">Issues</p>
                          <p className="text-light-text dark:text-dark-text font-medium">
                            {job.metadata.totalIssues}
                            {job.metadata.critical > 0 && (
                              <span className="text-red-500 ml-1">
                                ({job.metadata.critical} critical)
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                      {job.metadata?.cached && (
                        <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="font-medium">Cached</span>
                        </div>
                      )}
                    </div>

                    {job.status === 'failed' && job.errorMessage && (
                      <div className="flex items-center space-x-2 mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <p className="text-sm text-red-700 dark:text-red-300">
                          {job.errorMessage}
                        </p>
                      </div>
                    )}
                  </div>

                  {job.status === 'completed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/report/${job._id}`);
                      }}
                      className="btn btn-secondary flex-shrink-0"
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
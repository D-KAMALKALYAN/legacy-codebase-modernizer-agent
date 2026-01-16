import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Download, 
  ArrowLeft, 
  FileText, 
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiRequest, ENDPOINTS, API_URL } from '../config/api';
import { useThemeStore } from '../store/themeStore';
import { formatDistanceToNow } from 'date-fns';
import GlobalLoader from '../components/ui/GlobalLoader';

const ReportPage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useThemeStore();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReport();
  }, [jobId]);

  const fetchReport = async () => {
    try {
      const response = await apiRequest(ENDPOINTS.REPORT(jobId));
      if (response.success) {
        setReport(response.data);
        console.log('📊 Report data:', response.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: Use metadata from backend response
  const getIssueCounts = () => {
    if (!report?.metadata) {
      console.warn('⚠️ No metadata found in report');
      return { total: 0, critical: 0, warnings: 0, info: 0 };
    }

    const counts = {
      total: report.metadata.totalIssues || 0,
      critical: report.metadata.critical || 0,
      warnings: report.metadata.warnings || 0,
      info: report.metadata.info || 0,
    };

    console.log('✅ Issue counts:', counts);
    return counts;
  };

  const issueCounts = getIssueCounts();

  const handleDownload = () => {
    const token = localStorage.getItem('token');
    const url = `${API_URL}${ENDPOINTS.DOWNLOAD_REPORT(jobId)}`;
    
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `report-${jobId}.md`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      })
      .catch(err => console.error('Download failed:', err));
  };

  if (loading) {
    return <GlobalLoader message="Loading report..." />;
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="card p-8 max-w-md text-center">
          <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-light-text dark:text-dark-text mb-2">
            Report Not Available
          </h2>
          <p className="text-light-muted dark:text-dark-muted mb-6">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const getSeverityBadge = (severity) => {
    const badges = {
      critical: { icon: AlertTriangle, className: 'badge-error', label: 'Critical' },
      warning: { icon: Info, className: 'badge-warning', label: 'Warning' },
      info: { icon: CheckCircle2, className: 'badge-info', label: 'Info' },
    };
    
    const badge = badges[severity] || badges.info;
    const Icon = badge.icon;

    return (
      <span className={`badge ${badge.className} flex items-center space-x-1`}>
        <Icon className="w-3 h-3" />
        <span>{badge.label}</span>
      </span>
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-ghost"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <button onClick={handleDownload} className="btn btn-primary">
            <Download className="w-4 h-4 mr-2" />
            Download Report
          </button>
        </div>

        {/* Report Info Card */}
        <div className="card p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              <div>
                <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">
                  {report.fileName}
                </h1>
                <p className="text-sm text-light-muted dark:text-dark-muted flex items-center space-x-2 mt-1">
                  <Clock className="w-4 h-4" />
                  <span>
                    Generated {formatDistanceToNow(new Date(report.generatedAt), { addSuffix: true })}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Stats - Now showing correct counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-dark-border">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Issues</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {issueCounts.total}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Critical</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {issueCounts.critical}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Warnings</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {issueCounts.warnings}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Info</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {issueCounts.info}
              </p>
            </div>
          </div>

          {/* Additional metadata */}
          {report.metadata?.cached && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  Results cached for faster loading
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Report Content */}
        <div className="card p-8">
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={isDark ? oneDark : oneLight}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                h1: ({ children }) => (
                  <h1 className="text-3xl font-bold text-light-text dark:text-dark-text mb-4">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-2xl font-bold text-light-text dark:text-dark-text mt-8 mb-4">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mt-6 mb-3">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-light-text dark:text-dark-text mb-4 leading-relaxed">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-2 mb-4 text-light-text dark:text-dark-text">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-2 mb-4 text-light-text dark:text-dark-text">
                    {children}
                  </ol>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary-500 pl-4 italic text-light-muted dark:text-dark-muted my-4">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {report.reportContent}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
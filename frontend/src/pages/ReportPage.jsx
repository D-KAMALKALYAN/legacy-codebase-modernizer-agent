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
    const downloadFileName = report.originalFileName 
      ? `report_${report.originalFileName.replace(/\.[^/.]+$/, '')}.md`
      : `report-${jobId}.md`;
    
    const url = `${API_URL}${ENDPOINTS.DOWNLOAD_REPORT(jobId)}`;
    
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', downloadFileName);
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
        <div className="card p-6 sm:p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-light-text dark:text-dark-text mb-2">
            Report Not Available
          </h2>
          <p className="text-sm sm:text-base text-light-muted dark:text-dark-muted mb-6">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary text-sm sm:text-base">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-4 sm:py-8 px-3 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-ghost w-full sm:w-auto text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <button onClick={handleDownload} className="btn btn-primary w-full sm:w-auto text-sm sm:text-base">
            <Download className="w-4 h-4 mr-2" />
            <span className="whitespace-nowrap">Download Report</span>
          </button>
        </div>

        {/* Report Info Card */}
        <div className="card p-4 sm:p-6 overflow-hidden">
          <div className="flex items-start justify-between mb-4 gap-3 min-w-0">
            <div className="flex items-start space-x-2 sm:space-x-3 min-w-0 flex-1">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-1" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-light-text dark:text-dark-text break-words">
                  {report.originalFileName || report.fileName}
                </h1>
                <p className="text-xs sm:text-sm text-light-muted dark:text-dark-muted flex items-center space-x-2 mt-1 flex-wrap">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="break-words">
                    Generated {formatDistanceToNow(new Date(report.generatedAt), { addSuffix: true })}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-dark-border">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Total Issues</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                {issueCounts.total}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Critical</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">
                {issueCounts.critical}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Warnings</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {issueCounts.warnings}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Info</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                {issueCounts.info}
              </p>
            </div>
          </div>

          {/* Additional metadata */}
          {report.metadata?.cached && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-400">
                  Results cached for faster loading
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Report Content */}
        <div className="card p-4 sm:p-8 overflow-hidden">
          <div className="prose prose-sm sm:prose-lg dark:prose-invert max-w-none break-words overflow-hidden">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <SyntaxHighlighter
                        style={isDark ? oneDark : oneLight}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                        }}
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className={`${className} break-words`} {...props}>
                      {children}
                    </code>
                  );
                },
                h1: ({ children }) => (
                  <h1 className="text-2xl sm:text-3xl font-bold text-light-text dark:text-dark-text mb-4 break-words">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl sm:text-2xl font-bold text-light-text dark:text-dark-text mt-8 mb-4 break-words">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg sm:text-xl font-semibold text-light-text dark:text-dark-text mt-6 mb-3 break-words">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-sm sm:text-base text-light-text dark:text-dark-text mb-4 leading-relaxed break-words">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-2 mb-4 text-sm sm:text-base text-light-text dark:text-dark-text break-words">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-2 mb-4 text-sm sm:text-base text-light-text dark:text-dark-text break-words">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="break-words">
                    {children}
                  </li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary-500 pl-3 sm:pl-4 italic text-sm sm:text-base text-light-muted dark:text-dark-muted my-4 break-words overflow-hidden">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto -mx-4 sm:mx-0 my-4">
                    <table className="min-w-full text-sm">
                      {children}
                    </table>
                  </div>
                ),
                pre: ({ children }) => (
                  <pre className="overflow-x-auto -mx-4 sm:mx-0 p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
                    {children}
                  </pre>
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
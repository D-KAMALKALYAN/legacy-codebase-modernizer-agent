import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  FileText, 
  FolderOpen, 
  FileArchive, 
  Code2, 
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { apiRequest, apiUpload, ENDPOINTS } from '../config/api';
import GlobalLoader from '../components/ui/GlobalLoader';

const UploadPage = () => {
  const [activeTab, setActiveTab] = useState('snippet');
  const [snippet, setSnippet] = useState('');
  const [language, setLanguage] = useState('js');
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();

  const languages = [
    { value: 'js', label: 'JavaScript' },
    { value: 'ts', label: 'TypeScript' },
    { value: 'py', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'go', label: 'Go' },
    { value: 'rb', label: 'Ruby' },
    { value: 'php', label: 'PHP' },
    { value: 'cs', label: 'C#' },
  ];

  const handleSnippetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiRequest(ENDPOINTS.UPLOAD_SNIPPET, {
        method: 'POST',
        body: JSON.stringify({
          code: snippet,
          language,
          fileName: fileName || `snippet.${language}`,
        }),
      });

      if (response.success) {
        navigate('/dashboard');
      }
    } catch (err) {
      if (err.message === 'AI_CREDITS_EXHAUSTED') {
      setError(
        "Oops! It looks like our AI credits are temporarily exhausted 😅 " +
        "Don't worry—Kamal will take care of the payment. Please check back shortly!"
      );
    } else {
      setError(err.message || 'Upload failed');
    }
    } finally {
      setLoading(false);
    }
  };

  const handleFileSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = activeTab === 'zip' ? ENDPOINTS.UPLOAD_ZIP : ENDPOINTS.UPLOAD_FOLDER;
      const response = await apiUpload(endpoint, formData);

      if (response.success) {
        navigate('/dashboard');
      }
    } catch (err) {
      if (err.message === 'AI_CREDITS_EXHAUSTED') {
      setError(
        "Oops! It looks like our AI credits are temporarily exhausted 😅 " +
        "Don't worry—Kamal will take care of the payment. Please check back shortly!"
      );
    } else {
      setError(err.message || 'Upload failed');
    }
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  if (loading) {
    return <GlobalLoader message="Uploading and analyzing your code..." />;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-light-text dark:text-dark-text mb-2">
            Upload Code for Analysis
          </h1>
          <p className="text-light-muted dark:text-dark-muted">
            Choose how you want to upload your legacy code
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center space-x-2 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 animate-slide-down">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-600 dark:text-red-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="card p-2 flex space-x-2">
          <button
            onClick={() => setActiveTab('snippet')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'snippet'
                ? 'bg-primary-600 text-white shadow-md'
                : 'text-light-text dark:text-dark-text hover:bg-light-surface dark:hover:bg-dark-elevated'
            }`}
          >
            <Code2 className="w-5 h-5" />
            <span className="font-medium">Code Snippet</span>
          </button>
          <button
            onClick={() => setActiveTab('zip')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'zip'
                ? 'bg-primary-600 text-white shadow-md'
                : 'text-light-text dark:text-dark-text hover:bg-light-surface dark:hover:bg-dark-elevated'
            }`}
          >
            <FileArchive className="w-5 h-5" />
            <span className="font-medium">ZIP File</span>
          </button>
        </div>

        {/* Content */}
        <div className="card p-8">
          {activeTab === 'snippet' ? (
            <form onSubmit={handleSnippetSubmit} className="space-y-6">
              {/* Language Selection */}
              <div>
                <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="input"
                >
                  {languages.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Name */}
              <div>
                <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                  File Name (Optional)
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder={`snippet.${language}`}
                  className="input"
                />
              </div>

              {/* Code Input */}
              <div>
                <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                  Paste Your Code
                </label>
                <textarea
                  value={snippet}
                  onChange={(e) => setSnippet(e.target.value)}
                  required
                  rows={15}
                  placeholder="function getData() {&#10;  var query = 'SELECT * FROM users';&#10;  return db.query(query);&#10;}"
                  className="input font-mono text-sm resize-none"
                />
              </div>

              <button type="submit" className="btn btn-primary w-full">
                <Upload className="w-5 h-5 mr-2" />
                Analyze Code
              </button>
            </form>
          ) : (
            <form onSubmit={handleFileSubmit} className="space-y-6">
              {/* File Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
                    : 'border-light-border dark:border-dark-border'
                }`}
              >
                <input
                  type="file"
                  id="file-upload"
                  accept=".zip"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <div className="space-y-4">
                    <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
                    <div>
                      <p className="text-lg font-semibold text-light-text dark:text-dark-text">
                        {file.name}
                      </p>
                      <p className="text-sm text-light-muted dark:text-dark-muted mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="btn btn-secondary"
                    >
                      Change File
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <FileArchive className="w-16 h-16 mx-auto text-light-muted dark:text-dark-muted" />
                    <div>
                      <p className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">
                        Drop your ZIP file here
                      </p>
                      <p className="text-sm text-light-muted dark:text-dark-muted mb-4">
                        or click to browse
                      </p>
                      <label htmlFor="file-upload" className="btn btn-secondary cursor-pointer">
                        Choose File
                      </label>
                    </div>
                    <p className="text-xs text-light-muted dark:text-dark-muted">
                      Maximum file size: 50 MB
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!file}
                className="btn btn-primary w-full"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload and Analyze
              </button>
            </form>
          )}
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="card p-4 space-y-2">
            <FileText className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-light-text dark:text-dark-text">
              Code Snippets
            </h3>
            <p className="text-sm text-light-muted dark:text-dark-muted">
              Quick analysis for small code samples
            </p>
          </div>
          <div className="card p-4 space-y-2">
            <FileArchive className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-light-text dark:text-dark-text">
              ZIP Archives
            </h3>
            <p className="text-sm text-light-muted dark:text-dark-muted">
              Full project analysis with folder structure
            </p>
          </div>
          <div className="card p-4 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            <h3 className="font-semibold text-light-text dark:text-dark-text">
              Instant Results
            </h3>
            <p className="text-sm text-light-muted dark:text-dark-muted">
              Cached analyses return in seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
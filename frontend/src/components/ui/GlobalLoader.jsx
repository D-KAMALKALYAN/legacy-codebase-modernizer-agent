import React from 'react';

const GlobalLoader = ({ message = 'Analyzing your code...' }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-6">
        {/* AI Robot Head */}
        <div className="relative robot-loader">
          <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-blue-600 rounded-2xl relative shadow-glow">
            {/* Robot Eyes */}
            <div className="absolute top-6 left-4 w-4 h-4 bg-white rounded-full robot-eyes"></div>
            <div className="absolute top-6 right-4 w-4 h-4 bg-white rounded-full robot-eyes"></div>
            
            {/* Robot Mouth */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-white rounded-full"></div>
            
            {/* Antenna */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-1 h-4 bg-primary-400"></div>
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-primary-400 rounded-full animate-bounce"></div>
          </div>
          
          {/* Rotating glow */}
          <div className="absolute inset-0 border-4 border-primary-500/30 rounded-2xl animate-spin-slow"></div>
        </div>
        
        {/* Loading text */}
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-light-text dark:text-dark-text">
            {message}
          </p>
          <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalLoader;
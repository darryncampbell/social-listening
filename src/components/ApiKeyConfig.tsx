'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faCheck, faTrash, faSpinner } from '@fortawesome/free-solid-svg-icons';
import styles from './ApiKeyConfig.module.css';

export default function ApiKeyConfig() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if API key is already configured on mount
  useEffect(() => {
    async function checkApiKey() {
      try {
        const response = await fetch('/api/config/api-key');
        const data = await response.json();
        setHasStoredKey(data.configured);
        setKeyPreview(data.preview);
      } catch {
        // Silently fail - key not configured
      } finally {
        setLoading(false);
      }
    }
    checkApiKey();
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch('/api/config/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save API key');
      }
      
      setHasStoredKey(true);
      setKeyPreview(data.preview);
      setApiKey(''); // Clear the input after saving
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch('/api/config/api-key', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to clear API key');
      }
      
      setHasStoredKey(false);
      setKeyPreview(null);
      setApiKey('');
    } catch (err: any) {
      setError(err.message || 'Failed to clear API key');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    setSaved(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>OpenAI API Key</h2>
        <div className={styles.loading}>
          <FontAwesomeIcon icon={faSpinner} spin /> Loading...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>OpenAI API Key</h2>
      <p className={styles.description}>
        Enter your OpenAI API key here. The key is stored securely in an HTTP-only cookie and cannot be accessed by JavaScript.
      </p>
      
      {error && (
        <div className={styles.error}>{error}</div>
      )}
      
      {hasStoredKey ? (
        // Key is configured - show preview and clear button
        <div className={styles.configuredRow}>
          <div className={styles.keyPreview}>
            <span className={styles.keyPreviewLabel}>Current key:</span>
            <code className={styles.keyPreviewValue}>{keyPreview}</code>
          </div>
          <button
            className={`${styles.actionButton} ${styles.clearButton}`}
            onClick={handleClear}
            disabled={saving}
            title="Clear API key"
          >
            {saving ? (
              <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
              <FontAwesomeIcon icon={faTrash} />
            )}
            <span>Clear</span>
          </button>
        </div>
      ) : (
        // No key configured - show input form
        <div className={styles.inputRow}>
          <div className={styles.inputWrapper}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={handleKeyChange}
              placeholder="sk-..."
              className={styles.input}
              disabled={saving}
            />
            <button
              type="button"
              className={styles.toggleButton}
              onClick={() => setShowKey(!showKey)}
              title={showKey ? 'Hide key' : 'Show key'}
            >
              <FontAwesomeIcon icon={showKey ? faEyeSlash : faEye} />
            </button>
          </div>
          
          <button
            className={`${styles.actionButton} ${styles.saveButton} ${saved ? styles.saved : ''}`}
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
            title="Save API key"
          >
            {saving ? (
              <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
              <FontAwesomeIcon icon={faCheck} />
            )}
            <span>{saved ? 'Saved!' : 'Save'}</span>
          </button>
        </div>
      )}
      
      {hasStoredKey && (
        <p className={styles.statusText}>
          ✓ API key is securely stored
        </p>
      )}
    </div>
  );
}

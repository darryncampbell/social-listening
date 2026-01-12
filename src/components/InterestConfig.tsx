'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faUndo } from '@fortawesome/free-solid-svg-icons';
import { getInterest, saveInterest, resetInterest, DEFAULT_INTEREST } from '@/utils/interestConfig';
import styles from './InterestConfig.module.css';

export default function InterestConfig() {
  const [interest, setInterest] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setInterest(getInterest());
  }, []);

  const handleSave = () => {
    if (!interest.trim()) return;
    saveInterest(interest);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetInterest();
    setInterest(DEFAULT_INTEREST);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInterest(e.target.value);
    setSaved(false);
  };

  const isDefault = interest === DEFAULT_INTEREST;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Company or Person of Interest</h2>
      <p className={styles.description}>
        Entries mentioning this name will be tagged with a &quot;Mentions [name]&quot; label.
      </p>
      
      <div className={styles.inputRow}>
        <input
          type="text"
          value={interest}
          onChange={handleChange}
          placeholder="e.g., LiveKit, Acme Corp"
          className={styles.input}
        />
        
        <button
          className={`${styles.actionButton} ${styles.saveButton} ${saved ? styles.saved : ''}`}
          onClick={handleSave}
          disabled={!interest.trim()}
          title="Save"
        >
          <FontAwesomeIcon icon={faCheck} />
          <span>{saved ? 'Saved!' : 'Save'}</span>
        </button>

        {!isDefault && (
          <button
            className={`${styles.actionButton} ${styles.resetButton}`}
            onClick={handleReset}
            title="Reset to default"
          >
            <FontAwesomeIcon icon={faUndo} />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}

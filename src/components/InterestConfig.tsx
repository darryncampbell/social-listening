'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faUndo, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { 
  getInterest, 
  saveInterest, 
  resetInterest, 
  DEFAULT_INTEREST,
  getRecognizedUsers,
  addRecognizedUser,
  removeRecognizedUser,
} from '@/utils/interestConfig';
import styles from './InterestConfig.module.css';

export default function InterestConfig() {
  const [interest, setInterest] = useState('');
  const [saved, setSaved] = useState(false);
  const [recognizedUsers, setRecognizedUsers] = useState<string[]>([]);
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    setInterest(getInterest());
    setRecognizedUsers(getRecognizedUsers());
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

  const handleAddUser = () => {
    const trimmed = newUsername.trim();
    if (!trimmed) return;
    
    // Check if already exists (case-insensitive)
    if (recognizedUsers.some(u => u.toLowerCase() === trimmed.toLowerCase())) {
      setNewUsername('');
      return;
    }
    
    addRecognizedUser(trimmed);
    setRecognizedUsers(getRecognizedUsers());
    setNewUsername('');
  };

  const handleRemoveUser = (username: string) => {
    removeRecognizedUser(username);
    setRecognizedUsers(getRecognizedUsers());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddUser();
    }
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

      {/* Recognized Users Subsection */}
      <div className={styles.subsection}>
        <h3 className={styles.subsectionTitle}>Recognized Users</h3>
        <p className={styles.subsectionDescription}>
          List of usernames treated as &quot;recognized users&quot;
        </p>
        
        <div className={styles.inputRow}>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a username..."
            className={styles.input}
          />
          <button
            className={`${styles.actionButton} ${styles.addButton}`}
            onClick={handleAddUser}
            disabled={!newUsername.trim()}
            title="Add user"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Add</span>
          </button>
        </div>

        {recognizedUsers.length > 0 && (
          <div className={styles.userList}>
            {recognizedUsers.map((username) => (
              <div key={username} className={styles.userTag}>
                <span className={styles.userName}>{username}</span>
                <button
                  className={styles.removeUserBtn}
                  onClick={() => handleRemoveUser(username)}
                  title={`Remove ${username}`}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            ))}
          </div>
        )}

        {recognizedUsers.length === 0 && (
          <p className={styles.emptyList}>No recognized users added yet.</p>
        )}
      </div>
    </div>
  );
}

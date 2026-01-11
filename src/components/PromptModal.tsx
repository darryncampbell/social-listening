'use client';

import { useState, useEffect } from 'react';
import {
  DEFAULT_ARTICLE_PROMPT,
  ARTICLE_PROMPT_STORAGE_KEY,
  savePrompt,
  DEFAULT_COMMENT_PROMPT,
  COMMENT_PROMPT_STORAGE_KEY,
  saveCommentPrompt,
} from '@/utils/promptConfig';
import styles from './PromptModal.module.css';

export type PromptType = 'article' | 'comment';

interface PromptModalProps {
  type: PromptType;
  onClose: () => void;
}

const config = {
  article: {
    title: 'Article Response Prompt',
    description: 'Set the default prompt used for generating AI responses to articles.',
    placeholder: 'Enter your article response prompt...',
    storageKey: ARTICLE_PROMPT_STORAGE_KEY,
    defaultPrompt: DEFAULT_ARTICLE_PROMPT,
    save: savePrompt,
  },
  comment: {
    title: 'Comment Response Prompt',
    description: 'Set the default prompt used for generating AI responses to comments.',
    placeholder: 'Enter your comment response prompt...',
    storageKey: COMMENT_PROMPT_STORAGE_KEY,
    defaultPrompt: DEFAULT_COMMENT_PROMPT,
    save: saveCommentPrompt,
  },
};

export default function PromptModal({ type, onClose }: PromptModalProps) {
  const [prompt, setPrompt] = useState('');
  const [saved, setSaved] = useState(false);

  const cfg = config[type];

  useEffect(() => {
    const stored = localStorage.getItem(cfg.storageKey);
    if (stored) {
      setPrompt(stored);
    } else {
      setPrompt(cfg.defaultPrompt);
    }
  }, [cfg.storageKey, cfg.defaultPrompt]);

  const handleSave = () => {
    cfg.save(prompt);
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 500);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3 className={styles.title}>{cfg.title}</h3>
        <p className={styles.description}>{cfg.description}</p>
        <textarea
          className={styles.textarea}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setSaved(false);
          }}
          placeholder={cfg.placeholder}
          rows={10}
        />
        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.saveButton} onClick={handleSave}>
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

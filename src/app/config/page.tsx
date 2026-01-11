import FeedList from '@/components/FeedList';
import ApiKeyConfig from '@/components/ApiKeyConfig';
import Link from 'next/link';
import styles from './page.module.css';

export default function ConfigPage() {
  return (
    <div className={styles.container}>
      <ApiKeyConfig />
      <FeedList />
      <div className={styles.footer}>
        <Link href="/" className={styles.doneButton}>
          Done
        </Link>
      </div>
    </div>
  );
}

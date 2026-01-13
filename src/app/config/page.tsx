import FeedList from '@/components/FeedList';
import ApiKeyConfig from '@/components/ApiKeyConfig';
import InterestConfig from '@/components/InterestConfig';
import SkoolConfig from '@/components/SkoolConfig';
import Link from 'next/link';
import styles from './page.module.css';

export default function ConfigPage() {
  return (
    <div className={styles.container}>
      <ApiKeyConfig />
      <InterestConfig />
      <FeedList />
      <SkoolConfig />
      <div className={styles.footer}>
        <Link href="/" className={styles.doneButton}>
          Done
        </Link>
      </div>
    </div>
  );
}

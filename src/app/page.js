'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, AlertCircle, FileText, Link as LinkIcon, KeyRound, Type, Hash, Activity, CheckCircle, XCircle, Search } from 'lucide-react';
import styles from './page.module.css';
import { analyzeContent } from './seoScoring';

const EEAT_CHECKLIST = [
  "Nội dung có cung cấp phân tích hoặc kinh nghiệm gốc không? (Experience/Expertise)",
  "Bài viết có giải quyết triệt để vấn đề người đọc đang tìm kiếm không?",
  "Tiêu đề có mô tả chính xác nội dung, tránh gây hiểu lầm?",
  "Hình ảnh có tên file mô tả và alt text tối ưu không?",
  "Nội dung có dễ đọc, câu từ ngắn gọn, chia đoạn hợp lý không?"
];

export default function Home() {
  const [formData, setFormData] = useState({
    title: '',
    keyword: '',
    lsi: '',
    internalLinks: '',
    apiKey: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const [scoreMode, setScoreMode] = useState('RankMath');
  const [seoResult, setSeoResult] = useState(null);
  const [checks, setChecks] = useState([false, false, false, false, false]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheck = (index) => {
    const newChecks = [...checks];
    newChecks[index] = !newChecks[index];
    setChecks(newChecks);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setResult('');
    setError('');
    setSeoResult(null);

    if (!formData.keyword) {
      setError('Từ khóa chính là bắt buộc!');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Có lỗi xảy ra khi gọi API');
      }

      setResult(data.content);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateScore = () => {
    if (!result) return;
    const analysis = analyzeContent(result, formData.keyword, scoreMode);
    setSeoResult(analysis);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <div className={styles.logoIcon}>
            <Sparkles size={28} />
          </div>
          <h1 className={styles.title}>SEO Content Writer Pro</h1>
        </div>
        <p className={styles.subtitle}>Tạo & Phân tích bài viết chuẩn Google E-E-A-T chỉ với 1 click</p>
      </header>

      <main className={styles.main}>
        <div className={styles.sidebar}>
          <div className={styles.formSection}>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label>
                  <KeyRound size={18} className={styles.inputIcon} />
                  OpenRouter API Key *
                </label>
                <input
                  type="password"
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={handleChange}
                  placeholder="Nhập API key của bạn"
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>
                  <Type size={18} className={styles.inputIcon} />
                  Tiêu đề bài viết
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="VD: Top 10 xu hướng xây dựng website năm nay"
                  className={styles.input}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>
                  <Hash size={18} className={styles.inputIcon} />
                  Từ khóa chính *
                </label>
                <input
                  type="text"
                  name="keyword"
                  value={formData.keyword}
                  onChange={handleChange}
                  placeholder="VD: xu hướng xây dựng website"
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>
                  <FileText size={18} className={styles.inputIcon} />
                  Từ khóa LSI (phân cách bằng phẩy)
                </label>
                <textarea
                  name="lsi"
                  value={formData.lsi}
                  onChange={handleChange}
                  placeholder="VD: website chuẩn SEO, UX/UI..."
                  className={styles.textarea}
                  rows={2}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>
                  <LinkIcon size={18} className={styles.inputIcon} />
                  Internal Links cần thêm
                </label>
                <textarea
                  name="internalLinks"
                  value={formData.internalLinks}
                  onChange={handleChange}
                  placeholder="VD: [Dịch vụ SEO](https://myweb.com/dich-vu-seo)"
                  className={styles.textarea}
                  rows={2}
                />
              </div>

              {error && (
                <div className={styles.errorBox}>
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={isLoading} className={styles.submitButton}>
                {isLoading ? (
                  <>
                    <div className={styles.spinner}></div>
                    Đang viết bài E-E-A-T...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Tạo Nội Dung Ngay
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Công cụ đánh giá SEO */}
          <div className={styles.toolSection}>
            <h3><Activity size={20} /> Chấm Điểm Bài Viết SEO</h3>
            <div className={styles.inputGroup}>
              <label>Tiêu chuẩn chấm điểm:</label>
              <select 
                value={scoreMode} 
                onChange={(e) => {
                  setScoreMode(e.target.value);
                  setSeoResult(null);
                }} 
                className={styles.select}
              >
                <option value="RankMath">Chấm theo RankMath (Đề xuất)</option>
                <option value="YoastSEO">Chấm theo Yoast SEO</option>
              </select>
            </div>
            <button 
              onClick={calculateScore} 
              disabled={!result || isLoading} 
              className={styles.scoreButton}
            >
              <Search size={20} /> Chấm điểm ngay
            </button>
          </div>

          {/* Checklist EEAT */}
          <div className={styles.toolSection}>
            <h3><CheckCircle size={20} /> Tiêu chí Google E-E-A-T</h3>
            <div className={styles.checklist}>
               {EEAT_CHECKLIST.map((item, id) => (
                 <label key={id} className={styles.checkItem}>
                   <input type="checkbox" checked={checks[id]} onChange={() => handleCheck(id)} />
                   <span>{item}</span>
                 </label>
               ))}
            </div>
          </div>

        </div>

        <div className={styles.resultSection}>
          <div className={styles.resultHeader}>
             <h2><FileText size={22} className={styles.inputIcon} /> Nội Dung Bài Viết</h2>
             {seoResult && (
               <div className={`${styles.scoreBadge} ${seoResult.score >= 80 ? styles.ok : seoResult.score < 50 ? styles.bad : ''}`}>
                 Điểm SEO ({scoreMode}): {seoResult.score}/100
               </div>
             )}
          </div>
          
          <div className={styles.resultContent}>
            {seoResult && (
              <div className={styles.feedbackList}>
                <h3 style={{color: 'white', marginBottom: '1rem'}}>Phân tích chi tiết:</h3>
                {seoResult.feedbacks.map((fb, i) => (
                  <div key={i} className={styles.feedbackItem}>
                    <div className={`${styles.feedbackIcon} ${fb.passed ? styles.pass : styles.fail}`}>
                      {fb.passed ? <CheckCircle size={20}/> : <XCircle size={20}/>}
                    </div>
                    <div className={styles.feedbackContent}>
                      <h4>{fb.description} ({fb.points}/{fb.maxPoints} pts)</h4>
                      <p>{fb.suggestion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isLoading ? (
              <div className={styles.loadingState}>
                <div className={styles.loadingSpinner}></div>
                <p>AI đang phác thảo dữ liệu và tối ưu E-E-A-T, vui lòng đợi vài giây...</p>
              </div>
            ) : result ? (
              <div className={styles.markdownWrapper}>
                 <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📝</div>
                <p>Nội dung bài viết sẽ hiển thị ở đây sau khi tạo</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

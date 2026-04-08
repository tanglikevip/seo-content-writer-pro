export function analyzeContent(content, keyword, mode) {
  if (!content) return { score: 0, feedbacks: [] };
  
  const kw = keyword.toLowerCase().trim();
  const lowerContent = content.toLowerCase();
  
  let score = 0;
  let feedbacks = [];

  const addFeedback = (points, maxPoints, description, suggestion) => {
    score += points;
    feedbacks.push({ points, maxPoints, description, suggestion, passed: points >= maxPoints / 2 });
  };

  // Helper patterns
  const h2Count = (content.match(/^##\s/gm) || []).length;
  const h3Count = (content.match(/^###\s/gm) || []).length;
  const wordCount = content.split(/\s+/).length;
  const kwCount = (lowerContent.match(new RegExp(kw, 'g')) || []).length;
  const density = (kwCount / wordCount) * 100;
  
  const hasLink = /\[.*?\]\(.*?\)/g.test(content);
  const hasImage = /!\[.*?\]\(.*?\)/g.test(content);
  
  const h2Matches = Array.from(content.matchAll(/^##\s+(.*)/gm));
  let kwInH2 = false;
  if (h2Matches.length > 0 && h2Matches[0][1].toLowerCase().includes(kw)) {
    kwInH2 = true;
  }

  const titleMatch = content.match(/Meta Title:\*\*?\s*(.*)/i) || content.match(/^#\s+(.*)/m);
  const titleTxt = titleMatch ? titleMatch[1] : '';
  const kwInTitle = titleTxt.toLowerCase().includes(kw);

  const descMatch = content.match(/Meta Description:\*\*?\s*(.*)/i);
  const descTxt = descMatch ? descMatch[1] : '';
  const kwInDesc = descTxt.toLowerCase().includes(kw);

  if (mode === 'RankMath') {
    // Basic SEO (40 max)
    addFeedback(
      kwInTitle ? 10 : 0, 10,
      'Từ khóa trong Tiêu đề (SEO Title)',
      kwInTitle ? 'Tốt! Từ khóa chính xuất hiện trong tiêu đề.' : 'Hãy thêm từ khóa chính vào Meta Title hoặc H1.'
    );
    addFeedback(
      kwInDesc ? 10 : 0, 10,
      'Từ khóa trong Meta Description',
      kwInDesc ? 'Tốt! Từ khóa xuất hiện trong Meta Description.' : 'Thêm từ khóa chính vào Meta Description.'
    );
    addFeedback(
      wordCount >= 1200 ? 10 : (wordCount > 600 ? 5 : 0), 10,
      'Độ dài nội dung',
      wordCount >= 1200 ? 'Tuyệt vời, bài viết đủ dài (>1200 từ).' : 'Bài viết hơi ngắn. Khuyến nghị viết chi tiết hơn để đạt >1200 từ.'
    );
    addFeedback(
      (density >= 0.5 && density <= 2.5) ? 5 : 0, 5,
      'Mật độ từ khóa (0.5% - 2.5%)',
      (density >= 0.5 && density <= 2.5) ? `Mật độ chuẩn (${density.toFixed(1)}%).` : `Mật độ hiện tại ${density.toFixed(1)}%. Hãy điều chỉnh để tự nhiên hơn.`
    );
    addFeedback(
      hasLink ? 5 : 0, 5,
      'Liên kết nội bộ (Internal Link)',
      hasLink ? 'Đã có liên kết trong bài.' : 'Bạn nên chèn ít nhất 1 liên kết trỏ về bài khác trong website.'
    );

    // Additional SEO (20 max)
    addFeedback(
      kwInH2 ? 10 : 0, 10,
      'Từ khóa trong thẻ H2/H3',
      kwInH2 ? 'Bạn đã dùng từ khóa trong H2.' : 'Nên đưa từ khóa chính hoặc LSI vào thẻ H2 đầu tiên.'
    );
    addFeedback(
      hasImage ? 10 : 0, 10,
      'Hình ảnh bài viết',
      hasImage ? 'Có hình ảnh.' : 'Thêm hình ảnh với thuộc tính alt text để tăng cường SEO.'
    );

    // Title Readability (20 max)
    addFeedback(
      (titleTxt.length >= 40 && titleTxt.length <= 65) ? 10 : 5, 10,
      'Độ dài Tiêu đề',
      (titleTxt.length >= 40 && titleTxt.length <= 65) ? 'Độ dài tiêu đề hoàn hảo.' : 'Tiêu đề nên từ 50-60 ký tự.'
    );
    const hasEmotional = /cách|hướng dẫn|mẹo|bí quyết|tốt nhất|top|\d+/i.test(titleTxt);
    addFeedback(
      hasEmotional ? 10 : 0, 10,
      'Từ khóa tạo cảm xúc/Con số',
      hasEmotional ? 'Tiêu đề có yếu tố thu hút click.' : 'Nên thêm con số (Top 10) hoặc từ khóa cảm xúc (Bí quyết, Cách) vào tiêu đề.'
    );

    // Content Readability (20 max)
    const paragraphs = content.split('\\n\\n').filter(p => p.trim() !== '');
    const longParagraphs = paragraphs.filter(p => p.split('\\n').length > 5 || p.split(' ').length > 80);
    
    addFeedback(
      longParagraphs.length === 0 ? 10 : 0, 10,
      'Độ dài đoạn văn',
      longParagraphs.length === 0 ? 'Các đoạn văn được chia nhỏ dễ đọc.' : 'Có một vài đoạn quá dài (trên 4-5 dòng). Hãy ngắt dòng.'
    );
    addFeedback(
      (h2Count > 0 && h3Count > 0) ? 10 : 5, 10,
      'Phân bổ thẻ Heading',
      (h2Count > 0 && h3Count > 0) ? 'Sử dụng H2 và H3 hợp lý.' : 'Nên sử dụng thêm thẻ H2, H3 để chia bố cục rõ ràng.'
    );

  } else if (mode === 'YoastSEO') {
    // SEO Analysis (50 max)
    let seoScore = 0;
    if (kwInTitle) seoScore += 10;
    if (kwInDesc) seoScore += 10;
    if (kwInH2) seoScore += 10;
    if (density >= 0.5 && density <= 3) seoScore += 10;
    if (hasLink) seoScore += 10;
    
    addFeedback(
      kwInTitle ? 10 : 0, 10,
      'Từ khóa tại Tiêu đề',
      kwInTitle ? 'Từ khóa xuất hiện trong thẻ Title' : 'Yêu cầu: Tiêu đề phải chứa từ khóa.'
    );
    addFeedback(
      kwInDesc ? 10 : 0, 10,
      'Từ khóa trong Meta Description',
      kwInDesc ? 'Khá tốt' : 'Yêu cầu: bổ sung từ khóa vào Description.'
    );
    addFeedback(
      kwInH2 ? 10 : 0, 10,
      'Từ khóa trong H2',
      kwInH2 ? 'Đã có H2 chứa từ khóa' : 'Yêu cầu: H2 đầu tiên nên chứa từ khóa.'
    );
    addFeedback(
      (density >= 0.5 && density <= 3) ? 10 : 0, 10,
      'Mật độ từ khóa',
      (density >= 0.5 && density <= 3) ? 'Mật độ từ khóa chuẩn xác.' : 'Cảnh báo: Từ khóa xuất hiện quá ít hoặc quá nhiều.'
    );
    addFeedback(
      hasLink ? 10 : 0, 10,
      'Liên kết (Links)',
      hasLink ? 'Có External/Internal link' : 'Yêu cầu: Thêm liên kết vào bài viết.'
    );

    // Readability Analysis (50 max)
    const lines = content.split('\\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
    let longSentences = 0;
    lines.forEach(l => {
      const sentences = l.split(/[.?!]/);
      sentences.forEach(s => {
        if (s.split(' ').length > 25) longSentences++;
      });
    });

    addFeedback(
      longSentences < 5 ? 25 : 10, 25,
      'Độ dài câu',
      longSentences < 5 ? 'Hầu hết các câu đều ngắn ngọn.' : `Có ${longSentences} câu quá dài (trên 20 từ). Hãy tách thành các câu ngắn.`
    );

    const paragraphs = content.split('\\n\\n');
    addFeedback(
      paragraphs.length > 5 ? 25 : 10, 25,
      'Phân bổ bố cục (Transition / Paragraphs)',
      paragraphs.length > 5 ? 'Đoạn văn được chia tốt, bố cục thoáng.' : 'Bài viết hơi đặc chữ. Chú ý ngắt đoạn thường xuyên hơn.'
    );
  }

  // Cap score to 100
  score = Math.min(100, Math.max(0, score));

  return { score: Math.round(score), feedbacks };
}

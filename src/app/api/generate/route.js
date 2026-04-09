import { NextResponse } from 'next/server';

const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
const modelsToTry = [
  'meta-llama/llama-4-maverick',
  'anthropic/claude-3.5-sonnet',
  'deepseek/deepseek-chat',
  'google/gemini-2.0-pro-exp',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free'
];

async function callAI(messages, apiKey, temperature = 0.7, expectJson = false) {
  let lastErrorMsg = '';

  for (const model of modelsToTry) {
    try {
      const response = await fetch(openRouterUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'SEO Content Writer Pro',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: temperature,
          max_tokens: 5000,
          response_format: expectJson ? { type: "json_object" } : undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        lastErrorMsg = errorData;
        console.warn(`Model ${model} failed: ${errorData}`);
        continue; 
      }

      const aiData = await response.json();
      let content = aiData.choices?.[0]?.message?.content;

      if (!content) {
        lastErrorMsg = "Return content is empty";
        continue;
      }

      if (expectJson) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        } else {
          return JSON.parse(content);
        }
      }

      return content;
    } catch (e) {
      console.warn(`Error calling model ${model} (expectJson: ${expectJson}):`, e);
      lastErrorMsg = e.message;
    }
  }
  
  if (expectJson) {
    return {
      rankmathScore: 0,
      yoastScore: 0,
      missingCriteria: ["Lỗi hệ thống chấm điểm mở rộng"],
      suggestions: ["Vui lòng đánh giá thủ công."]
    };
  }

  throw new Error(`OpenRouter API error (All fallback models failed). Lỗi gần nhất: ${lastErrorMsg}`);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { title, keyword, lsi, internalLinks, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'Vui lòng cung cấp OpenRouter API Key' }, { status: 400 });
    }

    // 1. CHUẨN HÓA LSI & INTERNAL LINKS
    const lsiArray = lsi ? Array.from(new Set(lsi.split(',').map(s => s.trim()).filter(Boolean))).slice(0, 5) : [];
    const lsiStr = lsiArray.length > 0 ? lsiArray.join(', ') : 'Không có';
    const internalLinkStr = internalLinks && internalLinks.trim() ? internalLinks : 'Không có';

    let loopCount = 0;
    let bestArticle = '';
    let bestScoreAvg = -1;
    let bestRating = null;
    let missingCriteria = [];

    // VÒNG LẶP VIẾT - CHẤM - SỬA LỖI (Tối đa 3 lần)
    while (loopCount < 3) {
      loopCount++;
      console.log(`[AGENT V3] Khởi động vòng lặp Write-Rate thứ ${loopCount}...`);

      let writePrompt = '';
      if (loopCount === 1) {
        // Lần 1: Lệnh Viết Dựa Trên Khuôn Mẫu Gốc
        writePrompt = `Bạn là chuyên gia SEO & content có 10 năm kinh nghiệm, viết cho blog hacklike16.com. Hãy viết một bài blog TIẾNG VIỆT hoàn chỉnh, tuân thủ NGHIÊM NGẶT các yêu cầu sau.

**Thông tin đầu vào:**
- Tiêu đề: ${title || 'Tự chọn theo từ khóa'}
- Từ khóa chính: ${keyword}
- LSI keywords (phải chèn tự nhiên vào bài): ${lsiStr}
- Internal links (chèn đúng ngữ cảnh, mỗi link 1 lần): ${internalLinkStr}

**CẤU TRÚC BẮT BUỘC (phải có đủ, theo thứ tự):**

1. **Meta Title** (dưới 60 ký tự, chứa từ khóa chính, không giật tít)
2. **Meta Description** (2-3 câu, dưới 160 ký tự, chứa từ khóa chính, trả lời: bài viết nói gì? cho ai? giúp ích gì?)
3. **Mở đầu (Intro)** (200-300 từ):
   - Đặt vấn đề thực tế, đúng tâm lý người đọc đang lo lắng (ví dụ: livestream ít người xem, không tạo được tương tác).
   - Phản ánh đúng search intent (tìm hiểu/cân nhắc/lo lắng).
   - Có lồng ít nhất 1 LSI tự nhiên.
   - **Tuyệt đối không** liệt kê tính năng, không văn AI sáo rỗng.
4. **Thân bài (Body)** - dùng H2, H3, mỗi H2/H3 gắn một LSI khác nhau (tối thiểu 3 H2):
   - H2.1: [Câu hỏi hoặc vấn đề người dùng thực sự quan tâm]
     - H3.1: Giải thích bản chất vấn đề, không chỉ "làm thế nào".
     - H3.2: Ví dụ/trải nghiệm thực tế (kể một tình huống cụ thể, khó khăn đã gặp).
   - H2.2: Các yếu tố ảnh hưởng / rủi ro cần biết (phân tích thuật toán, giới hạn nền tảng).
   - H2.3: So sánh phương pháp (nếu cần).
   - H2.4: **Cách Thực Hiện Trong Thực Tế (Ví dụ Tham Khảo)** - bắt buộc.
       - Mở đầu đoạn: "Dưới đây là quy trình thực tế tôi đã áp dụng, mang tính tham khảo."
       - Danh sách tối đa 4 bước, mỗi bước 1 câu, mô tả thao tác chung (không chi tiết kỹ thuật, không giá cả).
       - Sau danh sách: 2-3 câu phân tích nhấn mạnh điều quan trọng là bối cảnh, mục tiêu, tốc độ, phù hợp nền tảng, kèm cảnh báo nhẹ.
   - Các H2 khác (tùy chủ đề, tối thiểu 3 H2).
5. **Kết luận** (150-200 từ):
   - Tóm tắt 3 ý chính.
   - CTA mềm: "Nếu bạn muốn tìm hiểu thêm, hãy đọc bài viết liên quan bên dưới."
   - Không ép mua dịch vụ.

**QUY TẮC VIẾT (RẤT QUAN TRỌNG):**
- **Giọng văn:** Bình tĩnh, rõ ràng, giàu trải nghiệm thực tế (giọng Hoàng Đạt). Không phô trương, không thổi phồng, không hứa hẹn "an toàn tuyệt đối". Viết như đang giải thích cho người nghiêm túc muốn hiểu vấn đề.
- **Hình thức:** Câu dưới 20 từ, đoạn dưới 5 dòng. Hạn chế câu bị động. Hạn chế danh sách (chỉ dùng 1-2 lần, mỗi lần tối đa 4 mục). Định dạng xuất toàn bộ bài bằng Markdown.
- **Từ khóa & LSI:** 
   - Từ khóa chính xuất hiện trong: Meta Title, Meta Description, H2 đầu tiên, đoạn mở đầu, và ít nhất 2 lần trong thân bài (mật độ 0.5%-2%).
   - **Mỗi LSI phải xuất hiện ít nhất 1 lần** trong các H2, H3 hoặc đoạn văn, một cách tự nhiên, không nhồi nhét.
- **Internal links:** Chèn **tất cả các link** được cung cấp vào bài, mỗi link một lần, tại vị trí có ngữ cảnh liên quan nhất. Anchor text không phải "xem thêm" hay "tại đây", mà là một cụm từ có nghĩa (ví dụ: "phương pháp tăng view đã được kiểm chứng"). Sử dụng syntax Markdown [anchor text](${internalLinkStr}). 
- **Độ dài:** 1500-2000 từ. Không kéo dài cho đủ chữ.
- **Cấm tuyệt đối:** Tiếng Anh, văn AI sáo rỗng (các cụm như "trong thế giới ngày nay", "không thể phủ nhận"), hứa hẹn quá mức, cấu trúc giống trang bán hàng, tự xưng chuyên gia.

**TỰ KIỂM TRA TRƯỚC KHI XUẤT:** Hãy đảm bảo bài viết đáp ứng được các tiêu chí Google E-E-A-T: có trải nghiệm thực tế, chuyên môn rõ ràng, lập luận có cơ sở, minh bạch.

Bắt đầu viết bài.`;
      } else {
        // CÁC LẦN REWRITE (sau khi Rater đánh giá trượt)
        writePrompt = `Bạn là chuyên gia SEO & content. Hãy viết lại bài viết dưới đây dựa trên bài cũ, tập trung cải thiện các tiêu chí thiếu sót sau đây:
${missingCriteria.map(c => `- ${c}`).join('\n')}

- Đặc biệt BẮT BUỘC chèn lại đầy đủ các LSI keywords sau một cách khéo léo vào các H2/H3: ${lsiStr}
- Đảm bảo internal link(s) sau vẫn được chèn đúng ngữ cảnh Markdown: ${internalLinkStr}
- TUYỆT ĐỐI GIỮ NGUYÊN cấu trúc H2/H3 chuẩn, giọng văn kinh nghiệm (Hoàng Đạt), không dùng ngôn ngữ máy móc. Đủ độ dài 1500-2000 từ. Định dạng xuất ra Markdown.

Nội dung bài cũ cần viết lại:
"""
${bestArticle}
"""`;
      }

      // Xử lý Lệnh Viết Bài (Temp 0.7 cho viết lần 1, 0.5 cho viết lại để bám form)
      let article = await callAI([{ role: 'user', content: writePrompt }], apiKey, loopCount === 1 ? 0.7 : 0.5);

      // Chấm Điểm
      const raterPrompt = `Hãy chấm bài viết blog sau đây theo thang điểm 100 cho **RankMath** và **YoastSEO** riêng biệt, dựa trên các tiêu chí chi tiết bên dưới. BẮT BUỘC HOÀN TRẢ VỀ CHUỖI JSON DUY NHẤT (SỬ DỤNG CHUẨN KÉP " " CHO TỪ KHÓA, VÍ DỤ {"rankmathScore": 85...}), không giải thích thêm.

**Tiêu chí RankMath (tổng 100):**
- Basic SEO (40đ): từ khóa ('${keyword}') trong Meta Title (10), trong Meta Description (10), độ dài nội dung >1200 từ (10), mật độ từ khóa 0.5-2.5% (5), có internal link (5).
- Readability (30đ): câu <20 từ (10), đoạn <5 dòng (10), heading hợp lý (H2, H3) (5), hạn chế câu bị động (5).
- Additional (30đ): LSI xuất hiện trong H2/H3 (10), có hình ảnh + alt text (10), tiêu đề chứa số hoặc từ cảm xúc (10).

**Tiêu chí YoastSEO (tổng 100):**
- SEO Analysis (50đ): từ khóa ('${keyword}') trong SEO Title (10), Meta Description (10), H2 đầu (10), đoạn mở đầu (10), mật độ vừa phải (10).
- Readability (50đ): độ dài câu (15), độ dài đoạn (15), heading phân cấp (10), hạn chế câu bị động (5), không quá nhiều từ chuyển tiếp (5).

Hãy phân tích bài viết và TRẢ VỀ JSON DUY NHẤT VỚI CÚ PHÁP CHUẨN NÀY:
{
  "rankmathScore": 80,
  "yoastScore": 75,
  "missingCriteria": [ "Mật độ từ khóa dưới 0.5%", "Chưa có thẻ H3" ],
  "suggestions": [ "Viết thêm các từ khóa liên quan", "Gắn thêm thẻ H3 cho bài" ]
}

Bài viết cần chấm:
"""
${article}
"""`;

      console.log(`[AGENT V3] Chấm điểm vòng ${loopCount}...`);
      let rating = await callAI([{ role: 'user', content: raterPrompt }], apiKey, 0.1, true);

      let rScore = rating.rankmathScore || 0;
      let yScore = rating.yoastScore || 0;
      let tempAvg = (rScore + yScore) / 2;

      console.log(`=> Điểm Vòng ${loopCount}: RankMath=${rScore}, Yoast=${yScore}`);

      // Ghi nhận Bài Tốt Nhất nếu Điểm cao hơn
      if (tempAvg > bestScoreAvg) {
        bestScoreAvg = tempAvg;
        bestArticle = article;
        bestRating = rating;
      }

      // ĐIỀU KIỆN THOÁT
      if (rScore >= 85 && yScore >= 85) {
        console.log("[AGENT] Bài viết thỏa mãn cực độ (>= 85 kép). XUẤT BẢN KẾT QUẢ!");
        break;
      }

      // Xây dựng Dữ liệu Viết Lại cho Vòng Sau (nếu có)
      missingCriteria = rating.missingCriteria || [];
      if (missingCriteria.length === 0) {
         missingCriteria = ["Cần tự nhiên hơn", "Kiểm tra kỹ lưỡng Readability", "Dùng LSI tự nhiên hơn"];
      }
    }

    // TỔNG HỢP OUTPUT MARKDOWN
    console.log(`[AGENT V3] Hoàn tất quá trình. Xây dựng bảng điểm Final...`);
    let isNeedManual = (bestRating.rankmathScore < 85 || bestRating.yoastScore < 85);
    
    let manualNoticeString = isNeedManual ? ' *(Cần chỉnh sửa thủ công thêm nhằm đạt yêu cầu tuyệt đối)*' : ' *(Đạt Chuẩn!)*';
    
    let scoreTableMarkdown = `\n\n---\n\n## 📊 BẢNG ĐÁNH GIÁ SEO${manualNoticeString}\n\n`;
    scoreTableMarkdown += `- **Điểm RankMath:** ${bestRating.rankmathScore}/100\n`;
    scoreTableMarkdown += `- **Điểm YoastSEO:** ${bestRating.yoastScore}/100\n\n`;

    if (bestRating.suggestions && bestRating.suggestions.length > 0) {
      scoreTableMarkdown += `**Các Gợi Ý Khắc Phục Khuyên Cải Thiện Thêm:**\n`;
      bestRating.suggestions.forEach((s, idx) => {
        scoreTableMarkdown += `${idx + 1}. ${s}\n`;
      });
    }

    const finalResult = bestArticle + scoreTableMarkdown;

    return NextResponse.json({ content: finalResult });
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json({ error: error.message || 'Đã có lỗi xảy ra.' }, { status: 500 });
  }
}

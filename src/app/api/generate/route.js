import { NextResponse } from 'next/server';

const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
const modelsToTry = [
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
          max_tokens: 5000
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
    // Return a default bad score so loop continues safely without crashing
    return {
      score: 0,
      details: { criteria: {} },
      suggestions: ["Lỗi khi chấm điểm hệ thống. Nội dung có thể không tối ưu."]
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

    const internalLinkStr = internalLinks && internalLinks.trim() ? internalLinks : 'Không có';

    // BƯỚC 1: VIẾT BÀI
    const writePrompt = `Bạn là chuyên gia SEO & content chiến lược, đang viết bài blog cho blog.hacklike16.com. Tuân thủ nghiêm ngặt các nguyên tắc sau:

Cấu trúc bắt buộc (theo thứ tự):
Meta Title (dưới 60 ký tự, chứa từ khóa)
Meta Description (2-3 câu, dưới 160 ký tự)
Giới thiệu (200-300 từ, đặt vấn đề thực tế, có LSI)
Body content với các heading H2/H3 (mỗi H2 gắn 1 LSI khác nhau, viết đoạn văn, hạn chế danh sách)
Section bắt buộc: "Cách Thực Hiện Trong Thực Tế (Ví dụ Tham Khảo)" (gồm 4 bước dạng liệt kê, mỗi bước 1 câu, kèm đoạn phân tích)
Kết luận (tóm tắt 3 điểm chính, CTA mềm)

CHÚ Ý QUAN TRỌNG VỀ INTERNAL LINK: Bạn BẮT BUỘC chèn đường link "${internalLinkStr}" vào đúng 1 vị trí siêu tự nhiên trong một đoạn văn (có liên quan ngữ cảnh). Anchor text phải là cụm từ có ý nghĩa (KHÔNG 'xem thêm' hay 'tại đây'). Cú pháp: [anchor text](${internalLinkStr}).

Giọng văn & phong cách:
Bình tĩnh, rõ ràng, giàu kinh nghiệm thực tế (giọng Hoàng Đạt).
Không phô trương, không hứa hẹn "an toàn tuyệt đối".
Không dùng ngôn ngữ bán hàng.
Viết như đang giải thích cho người nghiêm túc.

Đầu ra:
Xuất bài viết hoàn chỉnh với đầy đủ các phần trên định dạng Markdown. KHÔNG đánh giá SEO gì cả ở bước này.
Không được in ra code block bao bọc tòan bộ văn bản.

Bắt đầu viết bài với thông tin:
Tiêu đề: ${title || 'Tự chọn phù hợp với từ khóa'}
Từ khóa chính: ${keyword}
LSI keywords: ${lsi || 'Không có'}
Internal link: ${internalLinkStr}`;

    console.log("[AGENT] Bước 1: Khởi viết...");
    let article = await callAI([{ role: 'user', content: writePrompt }], apiKey, 0.7);

    // HÀM HELPER CHẤM ĐIỂM
    const getRatingPrompt = (articleContent) => `Bạn là Hệ thống Chấm điểm SEO. Hãy chấm điểm bài viết MỚI SAU ĐÂY theo thang 100 dựa trên các tiêu chí cứng sau:
1. Từ khóa (20đ): từ khóa chính '${keyword}' có trong Meta Title, Meta Description, H2 đầu tiên, đoạn mở đầu.
2. Readability (20đ): câu dưới 20 từ, đoạn dưới 5 dòng, có H2/H3 hợp lý, hạn chế câu bị động.
3. E-E-A-T (25đ): có phân tích thực tế, trải nghiệm cá nhân, giải thích rủi ro, không bán hàng.
4. Độ dài (10đ): >1200 từ (10đ), 800-1200 từ (5đ), <800 từ (0đ).
5. Internal Link (10đ): có chèn ĐÚNG 1 link "${internalLinkStr}" một cách tự nhiên (10đ), gượng ép (5đ), không có (0đ).
6. Section hướng dẫn (15đ): có đúng H2 "Cách Thực Hiện Trong Thực Tế...", có 4 bước, có phân tích, không quảng cáo.

BẮT BUỘC TRẢ VỀ CHỈ MỘT CHUỖI JSON DUY NHẤT (không giải thích thêm), đúng chuẩn sau:
{
  "score": 85,
  "details": {
    "criteria": {
      "keyword": { "diem": 20, "toi_da": 20, "nhan_xet": "..." },
      "readability": { "diem": 20, "toi_da": 20, "nhan_xet": "..." },
      "eeat": { "diem": 25, "toi_da": 25, "nhan_xet": "..." },
      "length": { "diem": 10, "toi_da": 10, "nhan_xet": "..." },
      "internalLink": { "diem": 10, "toi_da": 10, "nhan_xet": "..." },
      "realLifeGuide": { "diem": 15, "toi_da": 15, "nhan_xet": "..." }
    }
  },
  "suggestions": [
    "<gợi ý 1>",
    "<gợi ý 2>"
  ]
}

NỘI DUNG BÀI VIẾT:
"""
${articleContent}
"""`;

    console.log("[AGENT] Bước 2: Chấm điểm lần 1...");
    let rating = await callAI([{ role: 'user', content: getRatingPrompt(article) }], apiKey, 0.1, true);

    let bestArticle = article;
    let bestRating = rating;

    // BƯỚC 3: VÒNG LẶP SỬA BÀI (Max 2 lần)
    let loopCount = 0;
    while (loopCount < 2 && bestRating.score && bestRating.score < 85) {
      loopCount++;
      console.log(`[AGENT] Score: ${bestRating.score}. Chạy vòng lặp sửa lỗi thứ ${loopCount}...`);
      
      let rewritePrompt = `Bạn là chuyên gia biên tập SEO. Bài viết sau đây cần được cải thiện vì chỉ đạt ${bestRating.score}/100 điểm.
Các điểm yếu và gợi ý từ hệ thống cần khắc phục NGAY LẬP TỨC:
- ${bestRating.suggestions ? bestRating.suggestions.join('\\n- ') : 'Cải thiện E-E-A-T và Readability'}
- CHÚ Ý: Bắt buộc từ khóa chính '${keyword}' phải chuẩn xác.
- CHÚ Ý: Bắt buộc chèn internal link: "${internalLinkStr}" một cách TỰ NHIÊN, KHÔNG GƯỢNG ÉP.

HÃY CẢI THIỆN VÀ VIẾT LẠI TOÀN BỘ BÀI VIẾT NÀY. CHỈ cần trả về nội dung bài viết mới. Giữ nguyên cấu trúc Markdown tổng thể. Không trả về JSON.
Nội dung bài viết cũ:
"""
${bestArticle}
"""`;

      // Rewrite
      let rewrittenArticle = await callAI([{ role: 'user', content: rewritePrompt }], apiKey, 0.5);
      
      // Rerate
      console.log(`[AGENT] Chấm điểm lại vòng ${loopCount}...`);
      let newRating = await callAI([{ role: 'user', content: getRatingPrompt(rewrittenArticle) }], apiKey, 0.1, true);
      
      if (newRating.score && newRating.score > bestRating.score) {
        bestRating = newRating;
        bestArticle = rewrittenArticle;
      }
    }

    console.log(`[AGENT] Hoàn tất! Best Score: ${bestRating.score || 'Unknown'}`);

    // BƯỚC 4: TẠO BẢNG ĐIỂM
    let scoreTableMarkdown = `\n\n---\n\n## 📊 ĐÁNH GIÁ SEO\n\n`;
    if (bestRating.details && bestRating.details.criteria) {
      scoreTableMarkdown += `**Tổng Điểm:** ${bestRating.score} / 100\n\n`;
      const c = bestRating.details.criteria;
      for (const key in c) {
         if (c[key]) {
            scoreTableMarkdown += `- **${key.toUpperCase()}**: ${c[key].diem}/${c[key].toi_da}đ - *${c[key].nhan_xet}*\n`;
         }
      }
      if (bestRating.suggestions && bestRating.suggestions.length > 0) {
        scoreTableMarkdown += `\n**Gợi Ý Cải Thiện Đã Áp Dụng (Hoặc còn tồn đọng):**\n`;
        bestRating.suggestions.forEach((s, idx) => {
            scoreTableMarkdown += `${idx + 1}. ${s}\n`;
        });
      }
    } else {
       scoreTableMarkdown += `*Hệ thống ghi nhận điểm số nội bộ hoàn thành phân tích thuật toán.*\n`;
    }

    const finalResult = bestArticle + scoreTableMarkdown;

    return NextResponse.json({ content: finalResult });
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json({ error: error.message || 'Đã có lỗi xảy ra.' }, { status: 500 });
  }
}

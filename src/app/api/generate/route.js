import { NextResponse } from 'next/server';

const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
const modelsToTry = [
  'meta-llama/llama-4-maverick',
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
          'X-Title': 'SEO Content Writer Pro - Llama-4',
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
      console.warn(`Error calling model ${model}:`, e);
      lastErrorMsg = e.message;
    }
  }
  
  if (expectJson) return { score: 0, suggestions: [] };
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

    // ----------------------------------------------------
    // GIAI ĐOẠN 1: LẬP DÀN Ý (OUTLINE GENERATION)
    // ----------------------------------------------------
    console.log("[AGENT STAGE 1] Đang lập dàn ý...");
    
    const outlinePrompt = `Bạn là một chuyên gia Chiến lược Nội dung SEO & Information Architect. Nhiệm vụ của bạn là lập DÀN Ý (Outline) cực kỳ logic, mạch lạc và chi tiết cho bài website blog.
    
THÔNG TIN ĐẦU VÀO:
- Tiêu đề mong muốn: ${title || 'Tự chọn theo từ khóa'}
- Từ khóa chính: ${keyword}
- LSI keywords: ${lsi || 'Không có'}

YÊU CẦU DÀN Ý:
1. Phân bổ thẻ H2, H3 rõ ràng, nhắm trúng Intent của người tìm kiếm.
2. Gắn LSI khéo léo vào các H2/H3 hợp lý.
3. Mỗi Heading hãy kèm theo 1-2 gạch đầu dòng ghi chú "Ý chính cần triển khai" ngắn gọn làm cơ sở viết bài.
4. Bắt buộc có phần H2 mang tên y hệt: "Cách Thực Hiện Trong Thực Tế (Ví dụ Tham Khảo)" đằng trước phần Kết luận.

LƯU Ý: CHỈ TRẢ VỀ DÀN Ý, TUYỆT ĐỐI KHÔNG VIẾT BÀI CHI TIẾT TẠI ĐÂY.
Định dạng dưới dạng danh mục Markdown (sử dụng '#' cho H2, '##' cho H3... Wait, Markdown standard: '##' cho H2, '###' cho H3).`;

    let generatedOutline = await callAI([{ role: 'user', content: outlinePrompt }], apiKey, 0.7);


    // ----------------------------------------------------
    // GIAI ĐOẠN 2: VIẾT BÀI CHI TIẾT (FEW-SHOT & CHAIN-OF-THOUGHT)
    // ----------------------------------------------------
    console.log("[AGENT STAGE 2] Viết nội dung dựa trên dàn ý...");

    const articlePrompt = `Bạn là một chuyên gia SEO Copywriter thực chiến, đang viết cho blog.hacklike16.com. Hãy viết BÀI BLOG HOÀN CHỈNH dựa trên Dàn Ý do kiến trúc sư thông tin vừa lập bên dưới:

<DÀN_Ý>
${generatedOutline}
</DÀN_Ý>

Ngữ cảnh bài viết cần bao trùm:
- Tiêu đề: ${title || 'Tự chọn'}
- Từ khóa chính: ${keyword}

[1. QUY CHUẨN ĐỊNH DẠNG BẮT BUỘC]
- Viết hoàn toàn bằng Markdown (tuyệt đối không bọc nội dung trong block \`\`\`markdown).
- Phần mở đầu xuất chính xác 2 dòng:
   **Meta Title:** (dưới 60 ký tự, chứa từ khóa)
   **Meta Description:** (2-3 câu, chứa từ khóa)
- Theo đúng thứ tự và dàn ý bên trên để triển khai bài. 

[2. CHỈ THỊ CẤM NGHIÊM NGẶT (NEGATIVE PROMPTING)]
- TUYỆT ĐỐI KHÔNG dùng các cụm từ sáo rỗng rập khuôn AI như: "trong thế giới ngày nay", "không thể phủ nhận", "đầu tiên và quan trọng nhất", "chào mừng bạn đến với", "hơn thế nữa", "mặt khác", "khi nói đến".
- MỖI ĐOẠN VĂN: Cấm dài quá 60 từ. (Ngắt đoạn, xuống dòng liên tục để tạo sự thoáng đãng dễ đọc).
- MỖI CÂU VĂN: Cấm dài quá 25 từ. Viết câu tường minh, dứt khoát.
- CÚ PHÁP: Ưu tiên 100% sử dụng CÂU CHỦ ĐỘNG. Rất hạn chế/Cấm dùng cấu trúc bị động ("được cho là", "bị khóa", "bị tuột ảnh hưởng").

[3. E-E-A-T & ĐỘ SÂU]
- Viết từ góc nhìn của một người ĐÃ CÓ KINH NGHIỆM THỰC CHIẾN làm dịch vụ MXH (Giọng anh Hoàng Đạt).
- Trọng tâm phải lột tả: Chia sẻ VÍ DỤ THỰC TẾ, CÁC SAI LẦM, KHÓ KHĂN mà khách hay gặp và BÀI HỌC RÚT RA cụ thể.
- Đừng giảng đạo lý suông. Chỉ ra cách làm, chỉ ra lý do rủi ro tường tận cho khách hàng hiểu.

[4. KIỂM SOÁT INTERNAL LINK (RẤT QUAN TRỌNG)]
- Có 1 liên kết quan trọng: "${internalLinkStr}"
- CHỈ THỊ: Trong đoạn văn thứ 3 của phần thẻ H2 thứ 2 HOẶC một phần H2 có nội dung nói đến dịch vụ/hệ thống liên quan chặt chẽ nhất, HÃY CHÈN đúng 1 lần liên kết trên.
- Anchor text chèn link phải là NHỮNG CỤM TỪ CÓ NGHIÃ (ví dụ: giải pháp buff follow, quy trình kéo traffic thật...).
- CẤM NHẶT: Cấm dùng các cụm "xem thêm", "nhấn vào đây", "tại đây" để chèn link.

[5. FEW-SHOT PROMPTING - BẮT CHƯỚC VĂN PHONG]
Dưới đây là HAI VÍ DỤ MẪU về cách triển khai một khối Heading hoàn hảo. Cần sao chép tinh thần, cách độ dài đoạn, câu và cách truyền tải kinh nghiệm của ví dụ này:

--- BẮT ĐẦU VÍ DỤ MẪU 1 (E-E-A-T) ---
## Tại Sao Đa Số Tài Khoản Vẫn Mất Tương Tác Khi Mua Follow?
Rất nhiều bạn chủ shop tin rằng cứ bơm follow lên 10k thì auto có khách. Thực tế luôn ngược lại. Instagram sở hữu thuật toán dọn rác cực nhạy. Nó phân tích luồng traffic của bạn theo thời gian thực.
Nếu một ngày bạn chỉ có lác đác 10 người xem mà húc thẳng vào 5000 follow ảo, thuật toán sẽ gắn thẻ đỏ ngay tài khoản đó. Đây là sai lầm phổ thông nhất mà tôi gặp.
Kinh nghiệm của tôi sau 5 năm xử lý case này: Hãy xây phễu từ từ. Dàn trải lượng follow rải rác trong vòng 1 tuần. Kèm theo đó bắt buộc phải có action thật (như người thật cày like, save bài viết) bổ sung vào. Đừng vì nôn nóng vài đồng mà giết chết cái nick xây bao công.
--- KẾT THÚC VÍ DỤ MẪU 1 ---

--- BẮT ĐẦU VÍ DỤ MẪU 2 (HƯỚNG DẪN THỰC TẾ) ---
## Cách Thực Hiện Trong Thực Tế (Ví dụ Tham Khảo)
Đây là chuỗi thao tác thực tế chúng tôi setup cho khách hàng để đảm bảo an toàn tuyệt đối, bạn hãy đọc kỹ:
- Chạy hâm nóng nick: Đăng bài đều đặn trong 5 ngày đầu trước khi buff.
- Vào hệ thống chọn gói: Ưu tiên Server follow người dùng thật hoặc tài khoản đã nuôi lâu năm.
- Giãn cách số lượng: Gói 5k follow phải chọn chế độ nhảy nhỏ giọt (Drip-feed) rải trong 5 ngày.
- Quản trị độ trust: Cứ mỗi 1000 follow mới, tạo ra 20 bình luận gốc và 100 lượt thả tim trên Reels mới nhất.

Quá trình trên không chỉ là thao tác bấm nút. Vấn đề lõi trung tâm nằm ở tốc độ, độ tĩnh bối cảnh và sự liền mạch của tài khoản. Chỉ việc nhồi follow mà quên dồn tương tác nền tảng là nguyên nhân số một gây mất nick.
--- KẾT THÚC VÍ DỤ MẪU 2 ---

HÃY ÁP DỤNG TRỌN VẸN CHIẾN LƯỢC VÀ KIẾN TRÚC TRÊN CHO BÀI VIẾT NÀY!`;

    let finalArticle = await callAI([{ role: 'user', content: articlePrompt }], apiKey, 0.7);

    // KẾT QUẢ ĐẦU RA (Không cần dùng Loop nữa vì Chain-of-Thought + FewShot đã ra kim cương)
    console.log("[AGENT STAGE 2] Hoàn thành sinh nội dung.");

    let architectureMarkdown = `\n\n---\n*💡 Đánh giá Hệ thống: Llama-4-Maverick | Chain-of-Thought & Few-shot Framework*`;
    const finalResult = finalArticle + architectureMarkdown;

    return NextResponse.json({ content: finalResult });
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json({ error: error.message || 'Đã có lỗi xảy ra.' }, { status: 500 });
  }
}

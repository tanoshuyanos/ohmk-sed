import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export async function POST(request) {
  // --- ПРОВЕРКА КЛЮЧЕЙ В ТЕРМИНАЛЕ ---
  console.log("КЛЮЧ ID:", process.env.B2_KEY_ID);
  console.log("APP КЛЮЧ:", process.env.B2_APP_KEY);
  // ------------------------------------

  try {
    const formData = await request.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Файлы не найдены" }, { status: 400 });
    }

    // Подключаемся к Backblaze B2 через S3 API
    const s3Client = new S3Client({
      endpoint: process.env.B2_ENDPOINT, 
      region: process.env.B2_REGION || "us-east-005",
      credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APP_KEY,
      },
    });

    const urls = [];

    for (const file of files) {
      // Превращаем файл в буфер для загрузки
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Создаем уникальное имя файла, чтобы избежать перезаписи
      const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

      // Команда загрузки
      const command = new PutObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: file.type,
      });

      await s3Client.send(command);

      // Формируем публичную ссылку
      const publicUrl = `${process.env.B2_PUBLIC_URL}/file/${process.env.B2_BUCKET_NAME}/${fileName}`;
      urls.push(publicUrl);
    }

    // Возвращаем ссылки фронтенду
    return NextResponse.json({ urls });
    
  } catch (error) {
    console.error("Ошибка Backblaze:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
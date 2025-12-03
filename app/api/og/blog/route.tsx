import LogoFull2 from "@/app/components/svg/LogoFull2";
import { ImageResponse } from "next/og";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const author = searchParams.get("author");
  const description = searchParams.get("description");
  const blogImage = searchParams.get("image");
  if (!title || !author || !description || !blogImage) {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            fontSize: 32,
            fontWeight: 600,
          }}>
          <LogoFull2
            style={{
              width: 500,
            }}
          />
          <div style={{ marginTop: 1, margin: 50, marginBottom: 0, textAlign: "center" }}>Visit remoteworldwide.net </div>
          <div>for latest blog posts</div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          letterSpacing: "-.02em",
          fontWeight: 700,
          background: "#4f4f4f",
          position: "relative",
        }}>
        <img
          src={blogImage}
          alt="Blog Image"
          width="1200"
          height="630"
          style={{
            zIndex: 1,
            filter: "brightness(0.7)",
            width: "100%",
            height: "100%",
            position: "absolute",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            zIndex: 10,
            color: "white",
            left: 42,
            top: 42,
            position: "absolute",
            display: "flex",
            alignItems: "center",
          }}>
          <LogoFull2
            style={{
              width: 240,
              height: 24,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-end",
            width: "100%",
            height: "100%",
            padding: "40px",
            zIndex: 10,
            position: "relative",
          }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "flex-start",
              padding: "20px 30px",
              borderRadius: "8px",
              boxShadow: "4px 4px #e1f073",
              margin: "5px 0px",
              fontSize: 40,
              width: "auto",
              maxWidth: "90%",
              textAlign: "left",
              backgroundColor: "black",
              color: "white",
              lineHeight: 1.3,
            }}>
            {title}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "flex-start",
              padding: "10px 0px",
              fontSize: 24,
              width: "auto",
              maxWidth: "90%",
              textAlign: "left",
              fontWeight: 400,
              color: "white",
              marginTop: 8,
            }}>
            {description.length > 150 ? `${description.substring(0, 150)}...` : description}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "flex-start",
              padding: "8px 16px",
              borderRadius: "20px",
              fontSize: 18,
              width: "auto",
              maxWidth: 600,
              textAlign: "left",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              color: "#e1f073",
              marginTop: 12,
            }}>
            By {author}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

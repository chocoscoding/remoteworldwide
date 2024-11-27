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
          <span
            style={{
              width: 24,
              height: 24,
              background: "black",
            }}
          />
          <div style={{ marginTop: 1, margin: 50, marginBottom: 0, textAlign: "center" }}>Visit remoteworldwide.vercel.app </div>
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
          background: "white",
        }}>
        <img
          src={blogImage}
          alt="Blog Image"
          style={{
            zIndex: 1,
            filter: "brightness(0.7)",
            width: "100%",
            height: "100%",
            position: "absolute",
            borderRadius: "5px",
            boxShadow: "3.5px 3.5px #e1f073",
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
          <span
            style={{
              width: 24,
              height: 24,
              background: "white",
            }}
          />
          <span
            style={{
              marginLeft: 8,
              fontSize: 20,
            }}>
            remoteworldwide.vercel.app
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-end",
            width: "100%",
            height: "100%",
            padding: "10px",
            zIndex: 1,
            position: "relative",
          }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              padding: "15px",
              borderRadius: "5px",
              boxShadow: "3.5px 3.5px #e1f073",
              margin: "5px 0px",
              fontSize: 30,
              width: "auto",
              maxWidth: 700,
              textAlign: "center",
              border: "2px solid black",
              backgroundColor: "transparent",
              color: "white",
              lineHeight: 1.4,
            }}>
            {title}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              padding: "10px",
              borderRadius: "4px",
              fontSize: 20,
              width: "auto",
              maxWidth: 550,
              textAlign: "center",
              fontWeight: 400,
              color: "white",
              marginTop: -8,
            }}>
            {description}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              padding: "10px",
              borderRadius: "4px",
              fontSize: 20,
              width: "auto",
              margin: "2px 0px",
              maxWidth: 600,
              textAlign: "center",
              color: "#e1f073",
              marginTop: -8,
            }}>
            By {author}
          </div>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 400,
    }
  );
}

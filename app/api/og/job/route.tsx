import LogoMini from "@/app/components/svg/LogoMini";
import { ImageResponse } from "next/og";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const companyName = searchParams.get("company");
  const remoteType = searchParams.get("type");
  if (!title || !companyName || !remoteType) {
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
          <LogoMini
            style={{
              width: 24,
              height: 24,
            }}
          />
          <div style={{ marginTop: 1, margin: 50, marginBottom: 0, textAlign: "center" }}>Visit remoteworldwide.vercel.app </div>
          <div>for latest remote jobs</div>
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
        <div
          style={{
            left: 42,
            top: 42,
            position: "absolute",
            display: "flex",
            alignItems: "center",
          }}>
          <LogoMini
            style={{
              width: 24,
              height: 24,
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
            alignItems: "center",
            justifyContent: "center",
            marginTop: "30px",
          }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              padding: "15px",
              borderRadius: "5px",
              boxShadow: "3.5px 3.5px #e1f073",
              margin: "5px 30px",
              fontSize: 35,
              width: "auto",
              maxWidth: 700,
              textAlign: "center",
              backgroundColor: "black",
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
              margin: "2px 0px",
              maxWidth: 600,
              textAlign: "center",
              border: "1px solid black",
              boxShadow: "2.5px 2.5px #000000",
              color: "black",
              marginTop: 8,
            }}>
            {`@ ${companyName}`}
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
              backgroundColor: "black",
              color: "white",
              marginTop: 8,
            }}>
            {`🌎 Remote, ${remoteType}`}
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

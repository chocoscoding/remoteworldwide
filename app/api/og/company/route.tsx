import LogoFull2 from "@/app/components/svg/LogoFull2";
import { ImageResponse } from "next/og";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyName = searchParams.get("name");
  const companyLogo = searchParams.get("logo");
  const jobCount = searchParams.get("jobs");

  if (!companyName) {
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
              width: "550px",
            }}
          />
          <div style={{ marginTop: 1, margin: 50, marginBottom: 0, textAlign: "center", fontWeight: "600" }}>Visit remoteworldwide.net</div>
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
          <LogoFull2
            style={{
              width: "250px",
              height: "30.4px",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "60px",
          }}>
          {companyLogo && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "200px",
                height: "200px",
                borderRadius: "30px",
                overflow: "hidden",
                border: "3px solid black",
                boxShadow: "4px 4px #e1f073",
                marginBottom: "20px",
              }}>
              <img
                src={companyLogo}
                alt={companyName}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              padding: "8px 20px",
              borderRadius: "8px",
              boxShadow: "4px 4px #e1f073",
              margin: "5px 30px",
              fontSize: 30,
              width: "auto",
              maxWidth: 800,
              textAlign: "center",
              backgroundColor: "black",
              color: "white",
              lineHeight: 1.3,
            }}>
            {companyName}
          </div>
          {jobCount && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                padding: "12px 24px",
                borderRadius: "6px",
                fontSize: 24,
                width: "auto",
                maxWidth: 600,
                textAlign: "center",
                border: "2px solid black",
                boxShadow: "3px 3px #000000",
                color: "black",
                marginTop: 16,
              }}>
              {"View available Remote Jobs!!!"}
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

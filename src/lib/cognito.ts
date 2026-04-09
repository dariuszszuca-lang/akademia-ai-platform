const REGION = (process.env.NEXT_PUBLIC_COGNITO_REGION || "eu-central-1").trim();
const CLIENT_ID = (process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "fp5e0m207kg7sqe98p22c4p5f").trim();
// USER_POOL_ID will be needed for JWT verification on the server side
// const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!;

const COGNITO_URL = `https://cognito-idp.${REGION}.amazonaws.com`;

type CognitoResponse = {
  AuthenticationResult?: {
    AccessToken: string;
    IdToken: string;
    RefreshToken: string;
    ExpiresIn: number;
  };
  ChallengeName?: string;
  Session?: string;
  UserAttributes?: Array<{ Name: string; Value: string }>;
};

async function cognitoRequest(action: string, body: Record<string, unknown>): Promise<CognitoResponse> {
  const res = await fetch(COGNITO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = data.__type?.split("#").pop() || "UnknownError";
    const message = data.message || "Wystąpił błąd";
    throw new Error(`${error}: ${message}`);
  }

  return data;
}

export async function signUp(email: string, password: string, name: string) {
  return cognitoRequest("SignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "name", Value: name },
    ],
  });
}

export async function confirmSignUp(email: string, code: string) {
  return cognitoRequest("ConfirmSignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
  });
}

export async function signIn(email: string, password: string) {
  return cognitoRequest("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });
}

export async function refreshSession(refreshToken: string) {
  return cognitoRequest("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  });
}

export async function getUser(accessToken: string) {
  return cognitoRequest("GetUser", {
    AccessToken: accessToken,
  });
}

export async function signOut(accessToken: string) {
  return cognitoRequest("GlobalSignOut", {
    AccessToken: accessToken,
  });
}

export async function forgotPassword(email: string) {
  return cognitoRequest("ForgotPassword", {
    ClientId: CLIENT_ID,
    Username: email,
  });
}

export async function confirmForgotPassword(email: string, code: string, newPassword: string) {
  return cognitoRequest("ConfirmForgotPassword", {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
  });
}

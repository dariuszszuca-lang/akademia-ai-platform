# Current release acceptance — prerequisites

Pełny test akceptacyjny produkcji działa wyłącznie na koncie AWS
`261965598943`, profilu `akademia-ai` i w regionie `eu-central-1`.

## Sekret capability testu prawnego

Proces produkcyjny aplikacji i lokalny proces runnera wymagają zmiennej
`CURRENT_RELEASE_ACCEPTANCE_SECRET`.

- To osobny sekret tylko dla podpisywania krótkotrwałej capability testu
  akceptacyjnego. Nie wolno używać w tej roli `ADMIN_PASSWORD`.
- Sekret musi mieć co najmniej 32 losowe bajty zapisane jako base64url
  (minimum 43 znaki) i być inny niż wszystkie hasła administracyjne.
- Wartość przekazuje się wyłącznie przez zatwierdzony mechanizm sekretów do
  środowiska aplikacji i procesu runnera. Nie umieszcza się jej w argumentach
  CLI, logach, runbooku, raportach ani journalu.
- Brak lub niepoprawny format zatrzymuje runner przed preflightem kodem
  `CURRENT_RELEASE_ACCEPTANCE_SECRET_MISSING` albo
  `CURRENT_RELEASE_ACCEPTANCE_SECRET_INVALID`.
- Capability zawiera losowy nonce i wygasa najpóźniej po 60 sekundach.
  Serwer ogranicza próby przed weryfikacją podpisu i atomowo zużywa nonce
  tylko raz.

Ten runbook nie zawiera wartości sekretu ani nie autoryzuje jego utworzenia
lub zmiany w środowisku produkcyjnym.

## Kontrakt Cognito

Runner odczytuje identyfikator puli wyłącznie z parametru SSM:

```text
/property-intelligence-studio/prod/cognito-user-pool-id
```

Parametr:

- ma typ `String`;
- przechowuje niesekretny identyfikator puli z regionu `eu-central-1`;
- jest odczytywany bez deszyfrowania;
- wskazuje pulę z ARN konta `261965598943`;
- wskazana pula ma tagi:
  `Project=PropertyIntelligenceStudio` i `Env=prod`.

Brak parametru albo niezgodność ARN lub tagów zatrzymuje preflight kodem
`CURRENT_RELEASE_COGNITO_PREREQUISITE_MISSING:SEE_RUNBOOK`. Runner nie
przyjmuje identyfikatora puli ze zmiennych środowiskowych.

## Weryfikacja tylko do odczytu

Poniższe polecenia niczego nie tworzą ani nie modyfikują. Nie kopiuj ich
wyników do dokumentacji lub czatu.

```bash
aws ssm get-parameter \
  --name /property-intelligence-studio/prod/cognito-user-pool-id \
  --no-with-decryption \
  --profile akademia-ai \
  --region eu-central-1 \
  --query 'Parameter.{Name:Name,Type:Type}'

CURRENT_RELEASE_POOL_ID="$(aws ssm get-parameter \
  --name /property-intelligence-studio/prod/cognito-user-pool-id \
  --no-with-decryption \
  --profile akademia-ai \
  --region eu-central-1 \
  --query 'Parameter.Value' \
  --output text)"

aws cognito-idp describe-user-pool \
  --user-pool-id "$CURRENT_RELEASE_POOL_ID" \
  --profile akademia-ai \
  --region eu-central-1 \
  --query 'UserPool.{RegionPool:Id,Arn:Arn}'

CURRENT_RELEASE_POOL_ARN="$(aws cognito-idp describe-user-pool \
  --user-pool-id "$CURRENT_RELEASE_POOL_ID" \
  --profile akademia-ai \
  --region eu-central-1 \
  --query 'UserPool.Arn' \
  --output text)"

aws cognito-idp list-tags-for-resource \
  --resource-arn "$CURRENT_RELEASE_POOL_ARN" \
  --profile akademia-ai \
  --region eu-central-1 \
  --query 'Tags.{Project:Project,Env:Env}'

unset CURRENT_RELEASE_POOL_ID CURRENT_RELEASE_POOL_ARN
```

Utworzenie parametru lub uzupełnienie tagów jest zmianą chmurową Task 11.
Przed nią trzeba ponownie przeczytać `.claude/rules/cloud_safety.md` oraz
uzyskać wymaganą zgodę. Ten runbook nie autoryzuje provisioningu.

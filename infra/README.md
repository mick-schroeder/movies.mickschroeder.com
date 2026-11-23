# AWS setup

`template.yml` creates everything the site needs, once:

- an S3 bucket with static website hosting that holds the published files
- a CloudFront distribution serving it over HTTPS at `movies.mickschroeder.com`
- the TLS certificate and the Route 53 records (validated and created automatically)
- an IAM role that GitHub Actions assumes with OIDC. It only trusts the `main`
  branch of this repo and can only upload to the bucket and refresh the CloudFront cache.
- optionally, a monthly AWS Budget alert

Deploy it from your own machine with admin credentials. CI never changes infrastructure.

## 1. Check first

Find the hosted zone id for `mickschroeder.com`:

```bash
aws route53 list-hosted-zones-by-name --dns-name mickschroeder.com --query "HostedZones[0].Id" --output text
```

Make sure nothing already uses `movies.mickschroeder.com` (for example an Amplify app). This should print nothing:

```bash
aws route53 list-resource-record-sets --hosted-zone-id <ZONE_ID> --query "ResourceRecordSets[?Name=='movies.mickschroeder.com.']"
```

Check whether your account already has a GitHub OIDC provider. If this prints an ARN, pass it as `ExistingOidcProviderArn` below:

```bash
aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn" --output text
```

## 2. Deploy

Must be `us-east-1`, because CloudFront only uses certificates from there. The certificate step waits for DNS validation, so the first deploy takes 5 to 15 minutes.

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name movies-mickschroeder-com \
  --template-file infra/template.yml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    HostedZoneId=<ZONE_ID> \
    BudgetEmail=<you@example.com>
```

Add `ExistingOidcProviderArn=<ARN>` to the overrides if step 1 found one.

## 3. Connect GitHub

Print the outputs:

```bash
aws cloudformation describe-stacks --region us-east-1 --stack-name movies-mickschroeder-com --query "Stacks[0].Outputs" --output table
```

In the GitHub repo under **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
|---|---|---|
| Secret | `TMDB_KEY` | your TMDB API key |
| Secret | `MDBLIST_KEY` | your MDBList API key |
| Secret | `ANTHROPIC_API_KEY` | your Anthropic API key |
| Variable | `AWS_ROLE_ARN` | output `AwsRoleArn` |
| Variable | `AWS_BUCKET` | output `AwsBucket` |
| Variable | `CLOUDFRONT_DISTRIBUTION_ID` | output `CloudFrontDistributionId` |
| Variable (optional) | `ANTHROPIC_MODEL` | defaults to `claude-haiku-5-5` |

Then run the **publish** workflow from the Actions tab and check
`https://movies.mickschroeder.com/best-pictures.json`.

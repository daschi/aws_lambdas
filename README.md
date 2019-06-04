# aws_lambdas
Repository for AWS Lambda functions

Functions:
## DeleteS3FeatureBucket
## DeleteCFStack

### Setup
1. Install serverless (https://serverless.com)
2. run: `sls deploy`
3. Add the API endpoint url(s) to your Github repository's webhooks
4. Generate bucket names and/or CloudFormation stacks using this pattern: `${BRANCH_NAME}-${REPO_NAME}`
5. When a PR is merged, any configured webhooks will try to delete resources that match the named pattern (branch-name-repo-name).

# 📚 Book Recommendation Web App

An interactive book discovery platform powered by **Google Books API**, built using **HTML, CSS, and JavaScript**, and deployable via **GitHub Pages** or **fully automated Terraform-based AWS Infrastructure**. Users can explore, search, and filter book recommendations with a smooth UI and serverless backend.

## Architecture Overview

![Architecture Diagram](Book-recommendation-app.drawio.png)

### Tech Stack

- **Frontend:** HTML, CSS, JavaScript (S3 or GitHub Pages)
- **Backend:** AWS Lambda (Python), API Gateway (REST API)
- **Infra as Code:** Terraform
- **Authentication (Optional):** Amazon Cognito
- **Monitoring:** Amazon CloudWatch
- **State Management:** S3 + DynamoDB backend
- **Book Data Source:** Google Books API

---

## Deployment Instructions

### Project Structure

```
.
├── index.html
├── app.js
├── lambda/
│   └── lambda_function.zip
├── terraform/
│   ├── main.tf
|   ├── variables.tf
|   ├── outputs.tf
|   ├── backend.tf
└── README.md
```

---

###  Deployment Options

#### A. GitHub Pages (Frontend Only)
1. Push to a GitHub repository.
2. Go to Settings > Pages, set source to `main` and root folder.
3. App will be live at `https://<username>.github.io/<repo>/`
4. Ensure `API_ENDPOINT` in `app.js` points to your live API URL.

#### B. Full Stack Deployment with Terraform (Recommended)
1. Install [Terraform](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli) and [AWS CLI](https://aws.amazon.com/cli/).
2. Configure AWS CLI with `aws configure`
3. Create:
   - S3 bucket for Terraform state
   - DynamoDB table `terraform-locks` with `LockID` as primary key
4. Run the following:
   ```bash
   terraform init
   terraform apply -var="frontend_bucket_name=your-unique-bucket-name"
   ```
5. Outputs:
   - `website_url`: Public S3 frontend URL
   - `api_url`: API Gateway URL to use in `app.js`

---

## Live Demo
[Next Read](https://leonardkachi.github.io/Next-Read/)  
Deploy via:
- GitHub Pages (for frontend-only showcase)
- AWS Infrastructure via Terraform for complete functionality

---

## API Reference

### `GET /recommendations`

Returns a list of book recommendations from Google Books API.

```json
{
  "books": [
    {
      "id": "123",
      "title": "Clean Code",
      "author": "Robert C. Martin",
      "genre": "Programming",
      "rating": 4.7,
      "pageCount": 464,
      "description": "...",
      "image": "https://...",
      "purchaseLink": "https://...",
      "price": "$30.99"
    }
  ]
}
```

---

## Security & Infrastructure Notes

- Backend is secured via **API Gateway + IAM roles**
- Optional **Cognito** integration for user auth
- **Terraform backend** state stored in S3 and locked via DynamoDB
- CloudWatch is enabled for Lambda logging

---

## Author

**Obidiegwu Onyedikachi Henry Leonard**  
Cloud Security Architect | DevSecOps Engineer  
[GitHub](https://github.com/LeonardKachi) • [Portfolio](https://leonardkachi.github.io/Portfolio-website) • 📧 Henryleo480@gmail.com

---

## License

MIT — fork it, learn from it, build on it ✨

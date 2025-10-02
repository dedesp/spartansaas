# KreditKu Mobile App

Flutter mobile application for KreditKu pinjol platform.

## Architecture

Clean Architecture with Riverpod state management:

```
lib/
├── core/           # Core utilities, theme, router
├── data/           # Data layer (repositories, models, datasources)
├── domain/         # Business logic (entities, use cases)
└── presentation/   # UI layer (pages, widgets, providers)
```

## Features

- User authentication (login, register)
- Loan application workflow
- Payment management
- KYC verification with camera
- Push notifications
- Biometric authentication

## Tech Stack

- **State Management**: Riverpod
- **Networking**: Dio
- **Local Storage**: Hive + Shared Preferences
- **Navigation**: Go Router
- **UI**: Material Design 3

## Getting Started

### Prerequisites

- Flutter SDK >= 3.0.0
- Android Studio / Xcode

### Installation

```bash
# Install dependencies
flutter pub get

# Generate code
flutter pub run build_runner build --delete-conflicting-outputs

# Run app
flutter run
```

### Build

```bash
# Android
flutter build apk --release

# iOS
flutter build ios --release
```

## Project Structure

### Core Layer
- Theme configuration
- App router
- Constants
- Utilities

### Data Layer
- API clients
- Repository implementations
- Local storage
- DTOs/Models

### Domain Layer
- Business entities
- Use cases
- Repository interfaces

### Presentation Layer
- Pages/Screens
- Widgets
- State providers
- View models

## API Integration

Base URL: `http://localhost:4000/api`

All requests authenticated with JWT token in header:
```
Authorization: Bearer {token}
```

## State Management

Using Riverpod with providers:

```dart
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(authRepositoryProvider));
});
```

## Testing

```bash
# Unit tests
flutter test

# Integration tests
flutter test integration_test
```

## Build Configuration

### Android
- minSdkVersion: 21
- targetSdkVersion: 34

### iOS
- Deployment Target: 12.0

## To Be Implemented

- [ ] Complete all page implementations
- [ ] Add biometric authentication
- [ ] Implement push notifications
- [ ] Add camera integration for KYC
- [ ] Implement offline mode
- [ ] Add analytics

## License

UNLICENSED - Proprietary

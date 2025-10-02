import 'package:flutter/material.dart';

class LoanApplicationPage extends StatefulWidget {
  const LoanApplicationPage({super.key});

  @override
  State<LoanApplicationPage> createState() => _LoanApplicationPageState();
}

class _LoanApplicationPageState extends State<LoanApplicationPage> {
  final _formKey = GlobalKey<FormState>();
  String _loanType = 'conventional';
  double _loanAmount = 5000000;
  int _tenorDays = 30;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Apply for Loan'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Loan Details',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 24),

              // Loan Type
              const Text('Loan Type'),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(
                    value: 'conventional',
                    label: Text('Conventional'),
                  ),
                  ButtonSegment(
                    value: 'sharia',
                    label: Text('Sharia'),
                  ),
                ],
                selected: {_loanType},
                onSelectionChanged: (Set<String> selected) {
                  setState(() {
                    _loanType = selected.first;
                  });
                },
              ),
              const SizedBox(height: 24),

              // Loan Amount
              Text('Loan Amount: Rp ${_loanAmount.toStringAsFixed(0)}'),
              Slider(
                value: _loanAmount,
                min: 1000000,
                max: 20000000,
                divisions: 19,
                label: 'Rp ${_loanAmount.toStringAsFixed(0)}',
                onChanged: (value) {
                  setState(() {
                    _loanAmount = value;
                  });
                },
              ),
              const SizedBox(height: 24),

              // Tenor
              Text('Tenor: $_tenorDays days'),
              Slider(
                value: _tenorDays.toDouble(),
                min: 7,
                max: 365,
                divisions: 51,
                label: '$_tenorDays days',
                onChanged: (value) {
                  setState(() {
                    _tenorDays = value.toInt();
                  });
                },
              ),
              const SizedBox(height: 24),

              // Purpose
              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'Purpose',
                  hintText: 'e.g., working capital, education',
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter loan purpose';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // Summary Card
              Card(
                color: Colors.blue.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Loan Summary',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      const Divider(),
                      _buildSummaryRow('Principal', 'Rp ${_loanAmount.toStringAsFixed(0)}'),
                      _buildSummaryRow('Interest Rate', _loanType == 'conventional' ? '0.3% / day' : '0.25% / day'),
                      _buildSummaryRow('Tenor', '$_tenorDays days'),
                      const Divider(),
                      _buildSummaryRow(
                        'Total Interest',
                        'Rp ${(_loanAmount * (_loanType == 'conventional' ? 0.003 : 0.0025) * _tenorDays).toStringAsFixed(0)}',
                      ),
                      _buildSummaryRow(
                        'Total Payment',
                        'Rp ${(_loanAmount * (1 + (_loanType == 'conventional' ? 0.003 : 0.0025) * _tenorDays)).toStringAsFixed(0)}',
                        isBold: true,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),

              // Submit Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    if (_formKey.currentState!.validate()) {
                      // Submit loan application
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Loan application submitted!'),
                        ),
                      );
                    }
                  },
                  child: const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('Submit Application'),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}
